// musicaAmbiente.ts
// Música de fondo ambiental, 100% generada con Web Audio API — cero archivos
// de audio externos (mismo criterio que ya usa public/misiones/nucleo/
// audio-mision.js). No es un loop fijo: es un motor generativo que va
// evolucionando solo, así nunca se nota "el corte donde vuelve a empezar".
//
// Estética: pads sostenidos tipo órgano/coro, catedral de reverb bien
// larga y armonía que se mueve despacio — un mood amplio y solemne,
// pensado para sentarse cómodo debajo del resto del sitio sin apurar nada.
//
// Capas, de abajo hacia arriba:
//   1. Drone  — pedal grave fijo (dos fundamentales + un sub una octava
//               abajo), el "piso" del sonido.
//   2. Pads   — un acorde sostenido tipo órgano (fundamental + octava)
//               que va cambiando cada 55-85s con un crossfade largo y
//               attack lento (ciclo i–VI–III–VII, la progresión
//               "cinemática" clásica en La menor: Am9 → Fmaj9 → Cmaj9 → Gadd9).
//   3. Brillos — notas sueltas y espaciadas, agudas y cortas, tomadas del
//               acorde actual — la sensación de "estrellas titilando".
//   4. Aire   — ruido filtrado, muy grave y muy bajo en volumen, textura.
//   5. Pulso  — un latido grave y sordo, muy espaciado, tensión contenida.
// Todo pasa por una reverb de cola larga (delays en paralelo con feedback
// filtrado) para dar sensación de espacio inmenso sin necesitar un
// archivo de impulso.

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
  // Limitador de picos: con la reverb más grande y las capas nuevas (sub,
  // pulso, octava del pad) la suma de todo puede pasarse de 0dB en los
  // picos — este compresor actúa solo como red de seguridad, no como
  // efecto de sonido.
  const limitador = contexto.createDynamicsCompressor()
  limitador.threshold.value = -6
  limitador.knee.value = 0
  limitador.ratio.value = 20
  limitador.attack.value = .003
  limitador.release.value = .25
  master.connect(limitador).connect(contexto.destination)

  // ── Bus de reverb: cinco delays en paralelo con feedback filtrado ──────
  // Cola larga y oscura (tipo "catedral") en vez de la reverb corta de
  // antes — es lo que le da esa sensación de espacio inmenso y solemne.
  const envioReverbo = contexto.createGain()
  envioReverbo.gain.value = .7
  const retornoReverbo = contexto.createGain()
  retornoReverbo.gain.value = .78
  retornoReverbo.connect(master)
  for (const tiempo of [.31, .47, .64, .87, 1.15]) {
    const delay = contexto.createDelay(2)
    delay.delayTime.value = tiempo
    const feedback = contexto.createGain()
    feedback.gain.value = .48
    const filtro = contexto.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.value = 1500
    envioReverbo.connect(delay)
    delay.connect(filtro)
    filtro.connect(feedback)
    feedback.connect(delay)
    filtro.connect(retornoReverbo)
  }

  const salidaDirecta = contexto.createGain()
  salidaDirecta.gain.value = .85
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
  gananciaDrone.gain.setTargetAtTime(.26, contexto.currentTime + .3, 1.4)
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
  // Sub grave (una octava abajo del pedal): peso y gravedad, casi
  // imperceptible como nota, se siente más de lo que se escucha.
  {
    const osc = contexto.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = DRONE_HZ[0] / 2
    const ganancia = contexto.createGain()
    ganancia.gain.value = 0
    ganancia.gain.setTargetAtTime(.14, contexto.currentTime + .6, 2.2)
    osc.connect(ganancia).connect(filtroDrone)
    osc.start()
    limpiezas.push(() => { try { osc.stop() } catch { /* noop */ } osc.disconnect(); ganancia.disconnect() })
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
  gananciaRuido.gain.setTargetAtTime(.03, contexto.currentTime + .5, 3)
  fuenteRuido.connect(filtroRuido).connect(gananciaRuido)
  conectarFuente(gananciaRuido, .6, .8)
  fuenteRuido.start()
  limpiezas.push(() => { try { fuenteRuido.stop() } catch { /* noop */ } fuenteRuido.disconnect() })

  // ── Pads: acorde sostenido, cambia con crossfade cada 40-65s ───────────
  let indiceAcorde = 0
  let vocesActuales: { osc: OscillatorNode; octavaSuperior: OscillatorNode; ganancia: GainNode; gananciaOctava: GainNode; quitarLfo: () => void }[] = []
  let idProximoAcorde: ReturnType<typeof setTimeout> | null = null
  let detenido = false

  function iniciarAcorde(acorde: Acorde) {
    const nuevasVoces = acorde.parciales.map((hz, i) => {
      // Cada voz es un par (fundamental + una octava arriba, más floja) en
      // vez de un solo oscilador — así el pad suena a tubos de órgano en
      // vez de a un synth simple, sin dejar de ser 100% generado.
      const osc = contexto.createOscillator()
      osc.type = i === 0 ? 'triangle' : 'sine'
      osc.frequency.value = hz
      const octavaSuperior = contexto.createOscillator()
      octavaSuperior.type = 'sine'
      octavaSuperior.frequency.value = hz * 2
      const gananciaOctava = contexto.createGain()
      gananciaOctava.gain.value = .18
      const ganancia = contexto.createGain()
      ganancia.gain.value = 0
      const quitarLfo = crearLFO(contexto, ganancia.gain, .045 + i * .011, .012, i * .7)
      osc.connect(ganancia)
      octavaSuperior.connect(gananciaOctava).connect(ganancia)
      conectarFuente(ganancia, .55, .95)
      osc.start()
      octavaSuperior.start()
      // Attack largo (4s): entrada de órgano/coro, no de synth pad rápido.
      ganancia.gain.setTargetAtTime(.085, contexto.currentTime + .3, 4)
      return { osc, octavaSuperior, ganancia, gananciaOctava, quitarLfo }
    })
    const vocesViejas = vocesActuales
    vocesActuales = nuevasVoces
    if (vocesViejas.length) {
      for (const voz of vocesViejas) {
        voz.ganancia.gain.setTargetAtTime(0, contexto.currentTime, 3)
        const oscAGuardar = voz.osc
        const octavaAGuardar = voz.octavaSuperior
        setTimeout(() => {
          try { oscAGuardar.stop() } catch { /* noop */ }
          try { octavaAGuardar.stop() } catch { /* noop */ }
          oscAGuardar.disconnect()
          octavaAGuardar.disconnect()
          voz.gananciaOctava.disconnect()
          voz.ganancia.disconnect()
          voz.quitarLfo()
        }, 12000)
      }
    }
  }

  function programarProximoAcorde() {
    // Ciclo más lento (55-85s en vez de 40-65s): la armonía se mueve
    // como en un edit "slowed" — vasto y sin apuro.
    const esperaMs = (55 + Math.random() * 30) * 1000
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
      try { voz.octavaSuperior.stop() } catch { /* noop */ }
      voz.osc.disconnect()
      voz.octavaSuperior.disconnect()
      voz.gananciaOctava.disconnect()
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
    const pico = .08 + Math.random() * .05
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

  // ── Pulso: un latido grave y suave, muy espaciado ──────────────────────
  // Un solo golpe corto y sordo cada dos compases imaginarios — le da
  // tensión contenida y sensación de avance sin volverse percusión.
  let idProximoPulso: ReturnType<typeof setTimeout> | null = null
  let detenidoPulso = false

  function tocarPulso() {
    const osc = contexto.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 48
    const ganancia = contexto.createGain()
    ganancia.gain.value = 0
    osc.connect(ganancia)
    conectarFuente(ganancia, .9, .4)

    const ahora = contexto.currentTime
    ganancia.gain.linearRampToValueAtTime(.16, ahora + .05)
    ganancia.gain.setTargetAtTime(0, ahora + .09, .5)

    osc.start()
    osc.stop(ahora + 3)
    setTimeout(() => { osc.disconnect(); ganancia.disconnect() }, 3200)
  }

  function programarProximoPulso() {
    const esperaMs = (7 + Math.random() * 3) * 1000
    idProximoPulso = setTimeout(() => {
      if (detenidoPulso) return
      tocarPulso()
      programarProximoPulso()
    }, esperaMs)
  }
  programarProximoPulso()

  limpiezas.push(() => {
    detenidoPulso = true
    if (idProximoPulso) clearTimeout(idProximoPulso)
  })

  // ── fade-in del master ──────────────────────────────────────────────────
  // Tau corto (1.2s): a los ~3-4s ya se escucha claro, así al probarlo no
  // da la sensación de "no pasó nada" mientras el resto de las capas
  // (que tienen su propio fade-in más largo) siguen entrando de a poco.
  master.gain.setTargetAtTime(.85, contexto.currentTime + .05, 1.2)

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
