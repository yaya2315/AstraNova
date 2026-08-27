// musicaAmbiente.ts
// Música de fondo ambiental, 100% generada con Web Audio API — cero archivos
// de audio externos (mismo criterio que ya usa public/misiones/nucleo/
// audio-mision.js). No es un loop fijo: es un motor generativo que va
// evolucionando solo, así nunca se nota "el corte donde vuelve a empezar".
//
// Capas, de abajo hacia arriba:
//   1. Drone  — dos senoidales graves fijas (pedal), el "piso" del sonido.
//   2. Pads   — un acorde sostenido que va cambiando cada 40-65s con un
//               crossfade largo (ciclo i–VI–III–VII, el clásico progresión
//               "cinemática" en La menor: Am9 → Fmaj9 → Cmaj9 → Gadd9).
//   3. Brillos — notas sueltas y espaciadas, agudas y cortas, tomadas del
//               acorde actual — la sensación de "estrellas titilando".
//   4. Aire   — ruido filtrado, muy grave y muy bajo en volumen, textura.
// Todo pasa por un reverb simple (delays en paralelo con feedback filtrado)
// para dar sensación de espacio sin necesitar un archivo de impulso.

type Acorde = { nombre: string; parciales: number[] }

const ACORDES: Acorde[] = [
  { nombre: 'Am9', parciales: [110.00, 130.81, 164.81, 246.94] },
  { nombre: 'Fmaj9', parciales: [87.31, 110.00, 130.81, 196.00] },
  { nombre: 'Cmaj9', parciales: [130.81, 164.81, 196.00, 293.66] },
  { nombre: 'Gadd9', parciales: [98.00, 123.47, 146.83, 220.00] },
]

const DRONE_HZ = [55.00, 110.00] // A1 + A2, pedal fijo bajo todo el ciclo

let ctx: AudioContext | null = null
let master: GainNode | null = null
let destruirGrafo: (() => void) | null = null
let sonando = false
let iniciando = false

const suscriptores = new Set<(sonando: boolean) => void>()

function avisar() {
  for (const cb of suscriptores) cb(sonando)
}

export function estaSonandoMusica() {
  return sonando
}

/** Se llama con el estado actual de una — y cada vez que cambia. */
export function suscribirseMusica(cb: (sonando: boolean) => void) {
  suscriptores.add(cb)
  cb(sonando)
  return () => {
    suscriptores.delete(cb)
  }
}

function crearRuidoBuffer(contexto: AudioContext, segundos: number) {
  const buffer = contexto.createBuffer(1, contexto.sampleRate * segundos, contexto.sampleRate)
  const datos = buffer.getChannelData(0)
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1
  return buffer
}

/** LFO liviano: un oscilador de muy baja frecuencia empujando un AudioParam. */
function crearLFO(contexto: AudioContext, destino: AudioParam, hz: number, amplitud: number, fase = 0) {
  const osc = contexto.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = hz
  const ganancia = contexto.createGain()
  ganancia.gain.value = amplitud
  osc.connect(ganancia).connect(destino)
  osc.start(contexto.currentTime + fase)
  return () => { try { osc.stop() } catch { /* ya puede estar detenido */ } osc.disconnect(); ganancia.disconnect() }
}

function construirGrafo(contexto: AudioContext) {
  const limpiezas: Array<() => void> = []
  const master = contexto.createGain()
  master.gain.value = 0
  master.connect(contexto.destination)

  // ── Bus de reverb: tres delays en paralelo con feedback filtrado ───────
  const envioReverbo = contexto.createGain()
  envioReverbo.gain.value = .55
  const retornoReverbo = contexto.createGain()
  retornoReverbo.gain.value = .5
  retornoReverbo.connect(master)
  for (const tiempo of [.29, .41, .53]) {
    const delay = contexto.createDelay(1)
    delay.delayTime.value = tiempo
    const feedback = contexto.createGain()
    feedback.gain.value = .34
    const filtro = contexto.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.value = 1800
    envioReverbo.connect(delay)
    delay.connect(filtro)
    filtro.connect(feedback)
    feedback.connect(delay)
    filtro.connect(retornoReverbo)
  }

  const salidaDirecta = contexto.createGain()
  salidaDirecta.gain.value = .7
  salidaDirecta.connect(master)

  function conectarFuente(nodo: AudioNode, nivelSeco = 1, nivelReverbo = 1) {
    const seco = contexto.createGain()
    seco.gain.value = nivelSeco
    nodo.connect(seco).connect(salidaDirecta)
    const mojado = contexto.createGain()
    mojado.gain.value = nivelReverbo
    nodo.connect(mojado).connect(envioReverbo)
  }

  // ── Drone: pedal grave fijo, todo el ciclo ─────────────────────────────
  const filtroDrone = contexto.createBiquadFilter()
  filtroDrone.type = 'lowpass'
  filtroDrone.frequency.value = 500
  const quitarLfoDrone = crearLFO(contexto, filtroDrone.frequency, .025, 180)
  limpiezas.push(quitarLfoDrone)

  const gananciaDrone = contexto.createGain()
  gananciaDrone.gain.value = 0
  gananciaDrone.gain.setTargetAtTime(.16, contexto.currentTime + .5, 3)
  filtroDrone.connect(gananciaDrone)
  conectarFuente(gananciaDrone, .8, .5)

  for (const hz of DRONE_HZ) {
    for (const detuneCents of [-4, 4]) {
      const osc = contexto.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = hz
      osc.detune.value = detuneCents
      osc.connect(filtroDrone)
      osc.start()
      limpiezas.push(() => { try { osc.stop() } catch { /* noop */ } osc.disconnect() })
    }
  }

  // ── Aire: ruido filtrado muy grave, textura de fondo ───────────────────
  const fuenteRuido = contexto.createBufferSource()
  fuenteRuido.buffer = crearRuidoBuffer(contexto, 4)
  fuenteRuido.loop = true
  const filtroRuido = contexto.createBiquadFilter()
  filtroRuido.type = 'bandpass'
  filtroRuido.frequency.value = 400
  filtroRuido.Q.value = .7
  const quitarLfoRuido = crearLFO(contexto, filtroRuido.frequency, .017, 150, 2)
  limpiezas.push(quitarLfoRuido)
  const gananciaRuido = contexto.createGain()
  gananciaRuido.gain.value = 0
  gananciaRuido.gain.setTargetAtTime(.022, contexto.currentTime + 1, 4)
  fuenteRuido.connect(filtroRuido).connect(gananciaRuido)
  conectarFuente(gananciaRuido, .6, .8)
  fuenteRuido.start()
  limpiezas.push(() => { try { fuenteRuido.stop() } catch { /* noop */ } fuenteRuido.disconnect() })

  // ── Pads: acorde sostenido, cambia con crossfade cada 40-65s ───────────
  let indiceAcorde = 0
  let vocesActuales: { osc: OscillatorNode; ganancia: GainNode; quitarLfo: () => void }[] = []
  let idProximoAcorde: ReturnType<typeof setTimeout> | null = null
  let detenido = false

  function iniciarAcorde(acorde: Acorde) {
    const nuevasVoces = acorde.parciales.map((hz, i) => {
      const osc = contexto.createOscillator()
      osc.type = i === 0 ? 'triangle' : 'sine'
      osc.frequency.value = hz
      const ganancia = contexto.createGain()
      ganancia.gain.value = 0
      const quitarLfo = crearLFO(contexto, ganancia.gain, .06 + i * .015, .012, i * .7)
      osc.connect(ganancia)
      conectarFuente(ganancia, .55, .85)
      osc.start()
      ganancia.gain.setTargetAtTime(.05, contexto.currentTime + .3, 4)
      return { osc, ganancia, quitarLfo }
    })
    const vocesViejas = vocesActuales
    vocesActuales = nuevasVoces
    if (vocesViejas.length) {
      for (const voz of vocesViejas) {
        voz.ganancia.gain.setTargetAtTime(0, contexto.currentTime, 3)
        const oscAGuardar = voz.osc
        setTimeout(() => {
          try { oscAGuardar.stop() } catch { /* noop */ }
          oscAGuardar.disconnect()
          voz.ganancia.disconnect()
          voz.quitarLfo()
        }, 12000)
      }
    }
  }

  function programarProximoAcorde() {
    const esperaMs = (40 + Math.random() * 25) * 1000
    idProximoAcorde = setTimeout(() => {
      if (detenido) return
      indiceAcorde = (indiceAcorde + 1) % ACORDES.length
      iniciarAcorde(ACORDES[indiceAcorde])
      programarProximoAcorde()
    }, esperaMs)
  }

  iniciarAcorde(ACORDES[indiceAcorde])
  programarProximoAcorde()

  limpiezas.push(() => {
    detenido = true
    if (idProximoAcorde) clearTimeout(idProximoAcorde)
    for (const voz of vocesActuales) {
      try { voz.osc.stop() } catch { /* noop */ }
      voz.osc.disconnect()
      voz.ganancia.disconnect()
      voz.quitarLfo()
    }
  })

  // ── Brillos: notas sueltas y agudas, tomadas del acorde actual ─────────
  let idProximoBrillo: ReturnType<typeof setTimeout> | null = null
  let detenidoBrillos = false

  function tocarBrillo() {
    const acorde = ACORDES[indiceAcorde]
    const base = acorde.parciales[Math.floor(Math.random() * acorde.parciales.length)]
    const hz = base * (Math.random() < .5 ? 4 : 8)

    const osc = contexto.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz
    const armonico = contexto.createOscillator()
    armonico.type = 'sine'
    armonico.frequency.value = hz * 2
    const gananciaArmonico = contexto.createGain()
    gananciaArmonico.gain.value = .25

    const ganancia = contexto.createGain()
    ganancia.gain.value = 0
    const panorama = contexto.createStereoPanner()
    panorama.pan.value = Math.random() * 1.6 - .8

    osc.connect(ganancia)
    armonico.connect(gananciaArmonico).connect(ganancia)
    ganancia.connect(panorama)
    conectarFuente(panorama, .5, 1.1)

    const ahora = contexto.currentTime
    const pico = .05 + Math.random() * .03
    ganancia.gain.linearRampToValueAtTime(pico, ahora + .02)
    ganancia.gain.setTargetAtTime(0, ahora + .05, 1.4)

    osc.start()
    armonico.start()
    osc.stop(ahora + 4)
    armonico.stop(ahora + 4)
    setTimeout(() => {
      osc.disconnect(); armonico.disconnect(); gananciaArmonico.disconnect()
      ganancia.disconnect(); panorama.disconnect()
    }, 4200)
  }

  function programarProximoBrillo() {
    const esperaMs = (2.5 + Math.random() * 4) * 1000
    idProximoBrillo = setTimeout(() => {
      if (detenidoBrillos) return
      tocarBrillo()
      programarProximoBrillo()
    }, esperaMs)
  }
  programarProximoBrillo()

  limpiezas.push(() => {
    detenidoBrillos = true
    if (idProximoBrillo) clearTimeout(idProximoBrillo)
  })

  // ── fade-in del master ──────────────────────────────────────────────────
  master.gain.setTargetAtTime(.55, contexto.currentTime + .1, 2.5)

  return {
    master,
    destruir() {
      for (const limpiar of limpiezas) limpiar()
    },
  }
}

export async function alternarMusica() {
  if (sonando) {
    detenerMusica()
    return
  }
  await iniciarMusica()
}

export async function iniciarMusica() {
  if (sonando || iniciando || typeof window === 'undefined') return
  iniciando = true
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') await ctx.resume()

    const grafo = construirGrafo(ctx)
    master = grafo.master
    destruirGrafo = grafo.destruir

    sonando = true
    avisar()
  } finally {
    iniciando = false
  }
}

export function detenerMusica() {
  if (!sonando || !ctx || !master) return
  const contexto = ctx
  const masterActual = master
  const destruirActual = destruirGrafo
  masterActual.gain.setTargetAtTime(0, contexto.currentTime, .6)
  setTimeout(() => {
    destruirActual?.()
    masterActual.disconnect()
  }, 2200)
  master = null
  destruirGrafo = null
  sonando = false
  avisar()
}
