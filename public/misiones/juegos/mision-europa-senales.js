// mision-europa-senales.js — «Secuencia de Señales» (Europa Clipper)
// Ritmo y memoria espectral. El instrumento REASON dispara pulsos de radar
// que atraviesan el hielo y rebotan en la interfaz hielo-océano; el retardo
// del eco revela el grosor del hielo. Este juego es esa operación, convertida
// en ritmo: escuchar una secuencia de pulsos y retransmitirla en el momento
// exacto — con algunos pulsos "tapados" por interferencia joviana que hay que
// deducir por la estructura del patrón, no adivinar al azar.
import { suscribir } from '../nucleo/bucle-animacion.js'
import { crearEntrada } from '../nucleo/entrada-unificada.js'
import { tono, ruido } from '../nucleo/audio-mision.js'
import { evaluarEstrellas } from '../nucleo/evaluador-estrellas.js'

export const meta = {
  titulo: 'Europa Clipper · Secuencia de Señales',
  acento: '#5FD9C4',
  objetivo: 'Escuchá la secuencia de pulsos de radar y retransmitíla en el momento exacto.',
  datoInicial: 'El radar REASON de Europa Clipper atraviesa la corteza de hielo y rebota en el océano subglacial de abajo — el retardo del eco revela cuán grueso es el hielo.',
  datoCierre: 'REASON puede sondear hasta 30 km de profundidad en el hielo de Europa, buscando el océano líquido que se sospecha esconde debajo.',
}

// ── Constantes de la mecánica ────────────────────────────────────────────
const NOTAS = [
  { nombre: 'D3', frecuencia: 146.83 },
  { nombre: 'F3', frecuencia: 174.61 },
  { nombre: 'A3', frecuencia: 220.00 },
  { nombre: 'C4', frecuencia: 261.63 },
  { nombre: 'E4', frecuencia: 329.63 },
]
const TECLAS_CARRIL = ['1', '2', '3', '4', '5']
const TECLAS_CARRIL_ALT = ['a', 's', 'd', 'f', 'g']

const BPM_BASE = 100
const DURACION_NOTA = 0.12       // segundos
const RONDAS_POR_PARTIDA = 3
const COLA_FINAL_S = 0.6         // silencio tras el último pulso antes de retransmitir
const PRECISION_3_ESTRELLAS = 0.8
const VENTANA_PRECISION_MS = 40  // umbral de "golpe preciso" para 3 estrellas

const PARAMETROS_DIFICULTAD = {
  1: { pulsosBase: 3, ocultos: 0, ventanaMs: 180, factorTempo: 1 },
  2: { pulsosBase: 5, ocultos: 1, ventanaMs: 140, factorTempo: 1 },
  3: { pulsosBase: 7, ocultos: 2, ventanaMs: 100, factorTempo: 1.15 },
}

const DATOS_HIELO = [
  'En esta franja el hielo mide unos 15 km de espesor.',
  'Acá la corteza helada alcanza casi 25 km — más gruesa que en otras zonas.',
  'El hielo aquí es más fino: apenas 10 km sobre el océano líquido.',
]

// ── PRNG determinista (mulberry32) — misma semilla, misma partida ───────
function crearAleatorio(semilla) {
  let estado = semilla >>> 0
  return function () {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Generación de secuencias con estructura real ─────────────────────────
// Nunca carriles al azar puro: cada secuencia sigue uno de estos patrones
// completos, así CUALQUIER posición interior (salvo la primera/última) es
// deducible por continuidad del propio patrón — condición necesaria para que
// ocultar un pulso sea "justo" y no una adivinanza.
function generarSecuenciaCarriles(azar, longitud) {
  const generadores = [
    // Rebote triangular: sube y baja entre los bordes del rango de carriles.
    () => {
      const patron = []
      let carril = Math.floor(azar() * 3) // arranca en 0,1,2 → deja margen para subir
      let direccion = 1
      for (let i = 0; i < longitud; i++) {
        patron.push(carril)
        carril += direccion
        if (carril >= 4) { carril = 4; direccion = -1 }
        else if (carril <= 0) { carril = 0; direccion = 1 }
      }
      return patron
    },
    // Alternancia entre dos carriles fijos (llamada-respuesta).
    () => {
      const a = Math.floor(azar() * 5)
      let b = Math.floor(azar() * 4)
      if (b >= a) b += 1
      return Array.from({ length: longitud }, (_, i) => (i % 2 === 0 ? a : b))
    },
    // Arco simétrico (palíndromo): sube y refleja.
    () => {
      const patron = []
      const paso = azar() > 0.5 ? 1 : -1
      let carril = paso === 1 ? 0 : 4
      let direccion = paso
      for (let i = 0; i < longitud; i++) {
        patron.push(carril)
        if (i < Math.floor(longitud / 2) - 0.5) {
          carril += direccion
          if (carril >= 4 || carril <= 0) direccion *= -1
        } else {
          carril -= direccion
        }
      }
      return patron
    },
    // Escalón de a pares (0,0,1,1,2,2,...) — motivo muy reconocible al oído.
    () => {
      const patron = []
      let carril = Math.floor(azar() * 5)
      while (patron.length < longitud) {
        patron.push(carril, carril)
        carril = (carril + 1) % 5
      }
      return patron.slice(0, longitud)
    },
  ]
  const elegido = generadores[Math.floor(azar() * generadores.length)]
  return elegido()
}

// Elige qué índices ocultar: nunca el primero ni el último, nunca dos
// consecutivos — así el hueco siempre está rodeado de pulsos audibles que
// permiten deducirlo por continuidad del patrón.
function elegirIndicesOcultos(azar, longitud, cantidad) {
  if (cantidad <= 0) return new Set()
  const candidatos = []
  for (let i = 1; i < longitud - 1; i++) candidatos.push(i)
  for (let i = candidatos.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]
  }
  const elegidos = []
  for (const idx of candidatos) {
    if (elegidos.length >= cantidad) break
    if (!elegidos.some((e) => Math.abs(e - idx) === 1)) elegidos.push(idx)
  }
  return new Set(elegidos)
}

function generarRonda(azar, dificultad, numeroRonda) {
  const params = PARAMETROS_DIFICULTAD[dificultad]
  const longitud = params.pulsosBase + (numeroRonda - 1) // la secuencia crece dentro de la partida
  const bpm = BPM_BASE * params.factorTempo
  const intervaloMs = (60000 / bpm) / 2 // corchea

  const carriles = generarSecuenciaCarriles(azar, longitud)
  const ocultos = elegirIndicesOcultos(azar, longitud, params.ocultos)

  const secuencia = carriles.map((carril, i) => ({
    carril,
    t: i * intervaloMs,
    oculto: ocultos.has(i),
    resuelto: false,
    acierto: null,
    desviacionMs: null,
  }))

  const duracionMs = secuencia[secuencia.length - 1].t + DURACION_NOTA * 1000 + COLA_FINAL_S * 1000
  return { secuencia, duracionMs, ventanaMs: params.ventanaMs }
}

// ── Componente principal ─────────────────────────────────────────────────
export function crearMision(contenedor, opciones) {
  const azar = crearAleatorio(opciones.semilla >>> 0 || Date.now())
  const escuchas = new Map()
  function emitir(evento, detalle) {
    for (const cb of escuchas.get(evento) ?? []) cb(detalle)
  }

  let destruido = false
  let pausado = false
  let quitarSuscripcion = null
  let entrada = null
  let quitarLimpiezaTeclado = null

  let rondaActual = 1
  let ronda = null
  let faseActual = 'escucha' // 'escucha' | 'retransmision' | 'entre-rondas'
  // Acumulador de tiempo de fase en ms — se suma dt solo cuando no está
  // pausado, así pausar/reanudar no produce saltos (a diferencia de leer
  // performance.now() directamente, que sigue corriendo durante la pausa).
  let tiempoFaseMs = 0
  let indiceSiguientePulso = 0
  let pulsosVisuales = [] // { carril, tiempoInicio } — decaimiento del osciloscopio
  let flashFallo = 0      // >0 mientras dura el glitch visual de un fallo

  const fallosPorRonda = []
  const totalPulsosPorRonda = []
  let desviacionesAciertoMs = []

  // -- construcción del DOM --
  const estilo = document.createElement('style')
  estilo.textContent = CSS_JUEGO
  contenedor.appendChild(estilo)

  const raiz = document.createElement('div')
  raiz.className = 'ems-raiz'
  raiz.innerHTML = opciones.modoAccesible ? plantillaAccesible() : plantillaEstandar()
  contenedor.appendChild(raiz)

  const hud = raiz.querySelector('.ems-hud')

  function actualizarHud() {
    const totalFallos = fallosPorRonda.reduce((a, b) => a + b, 0)
    hud.textContent = `Ronda ${rondaActual} / ${RONDAS_POR_PARTIDA} · Fallos: ${totalFallos}`
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODO ESTÁNDAR — osciloscopio + línea de tiempo en vivo
  // ══════════════════════════════════════════════════════════════════════
  let canvasOsciloscopio, ctxOsciloscopio, canvasHielo, ctxHielo, lineaTiempo, botonesCarril

  function montarModoEstandar() {
    canvasOsciloscopio = raiz.querySelector('.ems-osciloscopio')
    canvasHielo = raiz.querySelector('.ems-hielo')
    lineaTiempo = raiz.querySelector('.ems-linea-tiempo')
    botonesCarril = [...raiz.querySelectorAll('.ems-carril')]
    redimensionarCanvas(canvasOsciloscopio)
    redimensionarCanvas(canvasHielo)
    ctxOsciloscopio = canvasOsciloscopio.getContext('2d')
    ctxHielo = canvasHielo.getContext('2d')

    botonesCarril.forEach((boton, i) => {
      boton.addEventListener('click', () => intentarGolpe(i))
    })

    entrada = crearEntrada(raiz)
    quitarLimpiezaTeclado = entrada.on('tecla-abajo', ({ tecla }) => {
      const iNum = TECLAS_CARRIL.indexOf(tecla)
      const iAlt = TECLAS_CARRIL_ALT.indexOf(tecla)
      const i = iNum >= 0 ? iNum : iAlt
      if (i >= 0) intentarGolpe(i)
    })
  }

  function redimensionarCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const r = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(r.width * dpr))
    canvas.height = Math.max(1, Math.round(r.height * dpr))
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function dibujarOsciloscopio(tiempoFaseMs) {
    const w = canvasOsciloscopio.clientWidth
    const h = canvasOsciloscopio.clientHeight
    ctxOsciloscopio.clearRect(0, 0, w, h)
    const altoCarril = h / NOTAS.length

    // Jitter de glitch cuando hay un fallo reciente — "la onda se distorsiona".
    const jitter = flashFallo > 0 ? (Math.random() - 0.5) * 10 * flashFallo : 0

    for (let i = 0; i < NOTAS.length; i++) {
      const y = altoCarril * i + altoCarril / 2
      ctxOsciloscopio.strokeStyle = 'rgba(95,217,196,0.18)'
      ctxOsciloscopio.lineWidth = 1
      ctxOsciloscopio.beginPath()
      ctxOsciloscopio.moveTo(0, y)
      ctxOsciloscopio.lineTo(w, y)
      ctxOsciloscopio.stroke()
    }

    for (const p of pulsosVisuales) {
      const edad = tiempoFaseMs - p.tiempoInicio
      if (edad < 0 || edad > 260) continue
      const decaimiento = 1 - edad / 260
      const y = altoCarril * p.carril + altoCarril / 2
      const amplitud = altoCarril * 0.38 * decaimiento
      ctxOsciloscopio.strokeStyle = `rgba(95,217,196,${0.9 * decaimiento})`
      ctxOsciloscopio.lineWidth = 2.5
      ctxOsciloscopio.beginPath()
      const ancho = 46
      const cx = Math.min(w - 4, Math.max(4, (edad / 260) * ancho + 4))
      for (let x = -ancho / 2; x <= ancho / 2; x += 2) {
        const px = cx + x + jitter
        const py = y - Math.sin((x / (ancho / 2)) * Math.PI) * amplitud * Math.exp(-Math.abs(x) / (ancho / 2.2))
        if (x === -ancho / 2) ctxOsciloscopio.moveTo(px, py)
        else ctxOsciloscopio.lineTo(px, py)
      }
      ctxOsciloscopio.stroke()
    }
  }

  function dibujarHielo() {
    const w = canvasHielo.clientWidth
    const h = canvasHielo.clientHeight
    ctxHielo.clearRect(0, 0, w, h)
    const n = ronda.secuencia.length
    const anchoFranja = h / n // el corte es vertical (apilado de arriba a abajo)

    for (let i = 0; i < n; i++) {
      const pulso = ronda.secuencia[i]
      const y = i * anchoFranja
      const perforado = pulso.resuelto && pulso.acierto
      const gradiente = ctxHielo.createLinearGradient(0, y, w, y)
      if (perforado) {
        gradiente.addColorStop(0, 'rgba(10,30,45,0.92)')
        gradiente.addColorStop(1, 'rgba(20,60,80,0.75)')
      } else {
        gradiente.addColorStop(0, 'rgba(210,240,238,0.9)')
        gradiente.addColorStop(1, 'rgba(150,200,210,0.75)')
      }
      ctxHielo.fillStyle = gradiente
      ctxHielo.fillRect(0, y + 1, w, anchoFranja - 2)
    }

    if (flashFallo > 0) {
      ctxHielo.fillStyle = `rgba(255,143,163,${0.25 * flashFallo})`
      for (let i = 0; i < 40; i++) {
        ctxHielo.fillRect(Math.random() * w, Math.random() * h, 2, 2)
      }
    }
  }

  function intentarGolpe(carrilIndex) {
    if (faseActual !== 'retransmision') return
    let objetivo = null
    for (const p of ronda.secuencia) {
      if (p.resuelto) continue
      if (Math.abs(tiempoFaseMs - p.t) <= ronda.ventanaMs) { objetivo = p; break }
    }
    if (!objetivo) return // pulsación fuera de ventana: no penaliza, se ignora

    objetivo.resuelto = true
    const acierto = objetivo.carril === carrilIndex
    objetivo.acierto = acierto
    objetivo.desviacionMs = Math.abs(tiempoFaseMs - objetivo.t)

    const boton = botonesCarril[carrilIndex]
    if (acierto) {
      boton.classList.remove('ems-carril--flash-fallo')
      boton.classList.add('ems-carril--flash-ok')
      setTimeout(() => boton.classList.remove('ems-carril--flash-ok'), 220)
      tono({ frecuencia: NOTAS[carrilIndex].frecuencia / 2, duracion: 0.15, tipo: 'triangle', ganancia: 0.18 })
      desviacionesAciertoMs.push(objetivo.desviacionMs)
    } else {
      registrarFallo(boton)
    }
  }

  function registrarFallo(boton) {
    fallosPorRonda[rondaActual - 1] += 1
    flashFallo = 1
    ruido({ duracion: 0.25, filtro: 800, ganancia: 0.12 })
    if (boton) {
      boton.classList.add('ems-carril--flash-fallo')
      setTimeout(() => boton.classList.remove('ems-carril--flash-fallo'), 260)
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODO ACCESIBLE — fichas reordenables, sin presión de tiempo
  // ══════════════════════════════════════════════════════════════════════
  let fichasEl, ordenActual, focoFicha

  function montarModoAccesible() {
    fichasEl = raiz.querySelector('.ems-fichas')
    // El corte de hielo (zona-derecha) es común a ambos modos, pero solo
    // montarModoEstandar() lo inicializaba — sin esto, cuadro() crashea acá
    // apenas entra a la fase 'entre-rondas' con canvasHielo aún undefined.
    canvasHielo = raiz.querySelector('.ems-hielo')
    redimensionarCanvas(canvasHielo)
    ctxHielo = canvasHielo.getContext('2d')
    // El primer dibujado real lo hace iniciarRonda() (llamada justo después,
    // desde iniciar()), una vez que existe `ordenActual` — dibujar acá antes
    // de esa ronda inicial rompe con "ordenActual is undefined".
    raiz.querySelector('[data-accion="verificar-orden"]').addEventListener('click', verificarOrdenAccesible)
  }

  function dibujarFichasAccesibles() {
    fichasEl.innerHTML = ''
    ordenActual.forEach((indiceOriginal, posicion) => {
      const pulso = ronda.secuencia[indiceOriginal]
      const ficha = document.createElement('div')
      ficha.className = 'ems-ficha'
      ficha.tabIndex = posicion === focoFicha ? 0 : -1
      ficha.dataset.posicion = String(posicion)

      if (pulso.oculto) {
        ficha.innerHTML = `
          <span class="ems-ficha-etiqueta">?</span>
          <div class="ems-ficha-selector" role="group" aria-label="Elegí el carril para esta ficha oculta">
            ${NOTAS.map((n, i) => `<button type="button" data-asignar="${i}" aria-pressed="${pulso.carrilAsignado === i}">${n.nombre}</button>`).join('')}
          </div>`
      } else {
        ficha.innerHTML = `<span class="ems-ficha-etiqueta">${NOTAS[pulso.carril].nombre}</span>
          <button type="button" class="ems-ficha-reproducir" aria-label="Reproducir esta nota">▶</button>`
      }
      fichasEl.appendChild(ficha)
    })

    fichasEl.querySelectorAll('.ems-ficha-reproducir').forEach((boton, i) => {
      boton.addEventListener('click', () => {
        const pulso = ronda.secuencia[ordenActual[i]]
        tono({ frecuencia: NOTAS[pulso.carril].frecuencia, duracion: DURACION_NOTA })
      })
    })
    fichasEl.querySelectorAll('[data-asignar]').forEach((boton) => {
      boton.addEventListener('click', (e) => {
        const ficha = boton.closest('.ems-ficha')
        const posicion = Number(ficha.dataset.posicion)
        const pulso = ronda.secuencia[ordenActual[posicion]]
        pulso.carrilAsignado = Number(boton.dataset.asignar)
        dibujarFichasAccesibles()
      })
    })
    fichasEl.querySelectorAll('.ems-ficha').forEach((ficha) => {
      ficha.addEventListener('keydown', (e) => {
        const posicion = Number(ficha.dataset.posicion)
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault()
          const destino = posicion + (e.key === 'ArrowRight' ? 1 : -1)
          if (destino < 0 || destino >= ordenActual.length) return
          ;[ordenActual[posicion], ordenActual[destino]] = [ordenActual[destino], ordenActual[posicion]]
          focoFicha = destino
          dibujarFichasAccesibles()
          fichasEl.children[destino]?.focus()
        }
      })
    })
  }

  function verificarOrdenAccesible() {
    let fallos = 0
    ordenActual.forEach((indiceOriginal, posicion) => {
      const pulso = ronda.secuencia[indiceOriginal]
      const carrilElegido = pulso.oculto ? pulso.carrilAsignado : pulso.carril
      const ordenCorrecto = posicion === indiceOriginal
      const carrilCorrecto = carrilElegido === pulso.carril
      pulso.resuelto = true
      pulso.acierto = ordenCorrecto && carrilCorrecto
      if (!pulso.acierto) fallos += 1
      else desviacionesAciertoMs.push(0) // sin línea de tiempo: cuenta como precisión perfecta
    })
    fallosPorRonda[rondaActual - 1] = fallos
    finalizarRonda()
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Orquestación de fases (común a ambos modos)
  // ══════════════════════════════════════════════════════════════════════
  function iniciarRonda() {
    ronda = generarRonda(azar, opciones.dificultad, rondaActual)
    ronda.secuencia.forEach((p) => { p.carrilAsignado = null })
    fallosPorRonda[rondaActual - 1] = 0
    totalPulsosPorRonda[rondaActual - 1] = ronda.secuencia.length
    indiceSiguientePulso = 0
    pulsosVisuales = []
    actualizarHud()

    if (opciones.modoAccesible) {
      ordenActual = ronda.secuencia.map((_, i) => i)
      // Se baraja para presentar las fichas desordenadas.
      for (let i = ordenActual.length - 1; i > 0; i--) {
        const j = Math.floor(azar() * (i + 1))
        ;[ordenActual[i], ordenActual[j]] = [ordenActual[j], ordenActual[i]]
      }
      focoFicha = 0
      dibujarFichasAccesibles()
      faseActual = 'entre-rondas' // sin presión de tiempo: el jugador arma cuando quiera
    } else {
      faseActual = 'escucha'
      tiempoFaseMs = 0
    }
  }

  function finalizarRonda() {
    actualizarHud()
    if (rondaActual >= RONDAS_POR_PARTIDA) {
      finalizarPartida()
    } else {
      rondaActual += 1
      setTimeout(iniciarRonda, opciones.modoAccesible ? 0 : 900)
    }
  }

  function finalizarPartida() {
    const totalFallos = fallosPorRonda.reduce((a, b) => a + b, 0)
    const totalPulsos = totalPulsosPorRonda.reduce((a, b) => a + b, 0)
    const aciertos = desviacionesAciertoMs.length
    const precisos = desviacionesAciertoMs.filter((d) => d <= VENTANA_PRECISION_MS).length
    const porcentajePrecision = aciertos > 0 ? precisos / aciertos : 0

    // Fallo catastrófico: si se perdió más de la mitad de la señal, la
    // misión no se considera superada (evento 'fallada' del contrato).
    if (totalFallos > totalPulsos / 2) {
      emitir('fallada', 'Se perdió más de la mitad de la señal entre el ruido joviano')
      return
    }

    const { estrellas } = evaluarEstrellas({
      metricas: { totalFallos, porcentajePrecision },
      umbrales: [
        { estrellas: 1, descripcion: 'Completar la secuencia', condicion: (m) => true },
        { estrellas: 2, descripcion: 'A lo sumo 1 fallo', condicion: (m) => m.totalFallos <= 1 },
        { estrellas: 3, descripcion: '0 fallos y ≥80% de golpes precisos', condicion: (m) => m.totalFallos === 0 && m.porcentajePrecision >= PRECISION_3_ESTRELLAS },
      ],
    })

    emitir('superada', { estrellas, totalFallos, porcentajePrecision })
  }

  // -- reproducción de la fase de escucha, pilotada por el bucle compartido --
  function cuadro(dt) {
    if (pausado) return
    if (faseActual === 'escucha' || faseActual === 'retransmision') tiempoFaseMs += dt * 1000
    emitir('progreso', Math.min(1, (rondaActual - 1 + Math.min(1, tiempoFaseMs / (ronda?.duracionMs || 1))) / RONDAS_POR_PARTIDA))

    if (flashFallo > 0) flashFallo = Math.max(0, flashFallo - dt * 4)

    if (faseActual === 'escucha') {
      while (indiceSiguientePulso < ronda.secuencia.length && ronda.secuencia[indiceSiguientePulso].t <= tiempoFaseMs) {
        const p = ronda.secuencia[indiceSiguientePulso]
        if (!p.oculto) {
          tono({ frecuencia: NOTAS[p.carril].frecuencia, duracion: DURACION_NOTA, tipo: 'sine', ganancia: 0.22 })
          pulsosVisuales.push({ carril: p.carril, tiempoInicio: tiempoFaseMs })
        }
        indiceSiguientePulso += 1
      }
      dibujarOsciloscopio(tiempoFaseMs)
      if (tiempoFaseMs >= ronda.duracionMs) {
        faseActual = 'retransmision'
        tiempoFaseMs = 0
        indiceSiguientePulso = 0
        pulsosVisuales = []
      }
    } else if (faseActual === 'retransmision') {
      dibujarOsciloscopio(tiempoFaseMs)
      dibujarHielo()
      const progresoBarrido = Math.min(1, tiempoFaseMs / ronda.duracionMs)
      if (lineaTiempo) lineaTiempo.style.transform = `translateX(${progresoBarrido * canvasOsciloscopio.clientWidth}px)`

      if (tiempoFaseMs >= ronda.duracionMs) {
        // Cualquier pulso no resuelto al terminar el barrido cuenta como fallo.
        for (const p of ronda.secuencia) {
          if (!p.resuelto) {
            p.resuelto = true
            p.acierto = false
            fallosPorRonda[rondaActual - 1] += 1
          }
        }
        dibujarHielo()
        mostrarDatoRonda()
        faseActual = 'entre-rondas'
        setTimeout(finalizarRonda, 1400)
      }
    } else {
      dibujarHielo()
    }
  }

  function mostrarDatoRonda() {
    const dato = raiz.querySelector('.ems-dato-ronda')
    if (dato) {
      dato.textContent = DATOS_HIELO[(rondaActual - 1) % DATOS_HIELO.length]
      dato.classList.add('ems-dato-ronda--visible')
    }
  }

  // ── contrato ──────────────────────────────────────────────────────────
  return {
    iniciar() {
      if (opciones.modoAccesible) montarModoAccesible()
      else montarModoEstandar()
      iniciarRonda()
      quitarSuscripcion = suscribir(cuadro)
    },
    pausar() { pausado = true },
    reanudar() { pausado = false },
    destruir() {
      if (destruido) return
      destruido = true
      quitarSuscripcion?.()
      entrada?.destruir()
      quitarLimpiezaTeclado?.()
      estilo.remove()
      contenedor.innerHTML = ''
      escuchas.clear()
    },
    on(evento, cb) {
      if (!escuchas.has(evento)) escuchas.set(evento, new Set())
      escuchas.get(evento).add(cb)
      return () => escuchas.get(evento)?.delete(cb)
    },
  }
}

// ── Plantillas de DOM ─────────────────────────────────────────────────────
function plantillaEstandar() {
  return `
    <div class="ems-zona-izquierda">
      <canvas class="ems-osciloscopio"></canvas>
      <div class="ems-linea-tiempo"></div>
      <div class="ems-carriles">
        ${NOTAS.map((n, i) => `
          <button type="button" class="ems-carril" data-carril="${i}" aria-label="Carril ${n.nombre} (tecla ${TECLAS_CARRIL[i]} o ${TECLAS_CARRIL_ALT[i].toUpperCase()})">
            <span>${n.nombre}</span>
          </button>`).join('')}
      </div>
    </div>
    <div class="ems-zona-derecha">
      <canvas class="ems-hielo"></canvas>
      <p class="ems-dato-ronda" aria-live="polite"></p>
    </div>
    <p class="ems-hud" aria-live="polite"></p>
  `
}

function plantillaAccesible() {
  return `
    <div class="ems-zona-accesible">
      <p class="ems-instrucciones">Ordená las fichas en la secuencia correcta. Para las fichas con «?», elegí el carril que corresponde por el patrón. Usá ← → para mover la ficha enfocada.</p>
      <div class="ems-fichas" role="list" aria-label="Secuencia de pulsos, desordenada"></div>
      <button type="button" class="ems-boton-verificar" data-accion="verificar-orden">VERIFICAR</button>
    </div>
    <div class="ems-zona-derecha">
      <canvas class="ems-hielo"></canvas>
      <p class="ems-dato-ronda" aria-live="polite"></p>
    </div>
    <p class="ems-hud" aria-live="polite"></p>
  `
}

// ── CSS del juego (inyectado y removido junto con el contenedor) ────────
const CSS_JUEGO = `
.ems-raiz {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--e-4, 1rem);
  width: 100%;
  height: 100%;
  color: #eafffb;
  font-family: inherit;
}
@media (min-width: 720px) {
  .ems-raiz { grid-template-columns: 7fr 3fr; grid-template-rows: 1fr auto; }
  .ems-zona-izquierda, .ems-zona-accesible { grid-column: 1; grid-row: 1; }
  .ems-zona-derecha { grid-column: 2; grid-row: 1; }
  .ems-hud { grid-column: 1 / -1; grid-row: 2; }
}
.ems-zona-izquierda, .ems-zona-accesible {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: rgba(10, 20, 24, .55);
  border-radius: .75rem;
  padding: var(--e-3, .75rem);
  overflow: hidden;
}
.ems-osciloscopio { flex: 1; width: 100%; min-height: 120px; }
.ems-linea-tiempo {
  position: absolute;
  top: var(--e-3, .75rem);
  bottom: calc(56px + var(--e-3, .75rem) * 2);
  left: var(--e-3, .75rem);
  width: 2px;
  background: rgba(255,255,255,.6);
  box-shadow: 0 0 8px rgba(255,255,255,.6);
  pointer-events: none;
  will-change: transform;
}
.ems-carriles {
  display: grid;
  grid-auto-flow: column;
  gap: var(--e-2, .5rem);
  margin-top: var(--e-3, .75rem);
}
.ems-carril {
  min-height: 56px;
  border-radius: .5rem;
  border: 1px solid rgba(95,217,196,.3);
  background: rgba(95,217,196,.08);
  color: #eafffb;
  font-size: var(--hud-label, .75rem);
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease;
}
.ems-carril:focus-visible { outline: 2px solid #5FD9C4; outline-offset: 2px; }
.ems-carril--flash-ok { background: rgba(95,217,196,.55); border-color: #5FD9C4; }
.ems-carril--flash-fallo { background: rgba(255,143,163,.4); border-color: #FF8FA3; }

.ems-zona-derecha {
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgba(10, 20, 24, .4);
  border-radius: .75rem;
  padding: var(--e-3, .75rem);
  min-height: 160px;
}
.ems-hielo { flex: 1; width: 100%; border-radius: .5rem; }
.ems-dato-ronda {
  margin: var(--e-2, .5rem) 0 0;
  font-size: var(--hud-label, .75rem);
  color: rgba(255,255,255,.7);
  text-align: center;
  opacity: 0;
  transition: opacity .4s ease;
}
.ems-dato-ronda--visible { opacity: 1; }

.ems-hud {
  text-align: center;
  font-size: var(--hud-label, .75rem);
  color: rgba(255,255,255,.6);
  letter-spacing: .06em;
  margin: 0;
}

/* ── Modo accesible ──────────────────────────────────────────────────── */
.ems-instrucciones { font-size: var(--hud-label, .75rem); color: rgba(255,255,255,.65); margin: 0 0 var(--e-3, .75rem); }
.ems-fichas { display: flex; flex-wrap: wrap; gap: var(--e-2, .5rem); flex: 1; align-content: flex-start; }
.ems-ficha {
  min-width: 72px;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--e-1, .25rem);
  padding: var(--e-2, .5rem);
  border-radius: .5rem;
  border: 1px solid rgba(95,217,196,.35);
  background: rgba(95,217,196,.1);
}
.ems-ficha:focus-visible { outline: 2px solid #5FD9C4; outline-offset: 2px; }
.ems-ficha-etiqueta { font-size: 1.1rem; font-weight: 700; }
.ems-ficha-reproducir, .ems-ficha-selector button {
  min-height: 44px;
  min-width: 44px;
  border-radius: .35rem;
  border: 1px solid rgba(255,255,255,.15);
  background: transparent;
  color: #eafffb;
  cursor: pointer;
  font-size: .7rem;
}
.ems-ficha-selector { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; }
.ems-ficha-selector button[aria-pressed="true"] { border-color: #5FD9C4; background: rgba(95,217,196,.3); }
.ems-boton-verificar {
  margin-top: var(--e-3, .75rem);
  min-height: 44px;
  border-radius: .5rem;
  border: 1px solid #5FD9C4;
  background: rgba(95,217,196,.16);
  color: #fff;
  cursor: pointer;
  align-self: flex-start;
}

@media (prefers-reduced-motion: reduce) {
  .ems-carril, .ems-dato-ronda { transition: none; }
}
`
