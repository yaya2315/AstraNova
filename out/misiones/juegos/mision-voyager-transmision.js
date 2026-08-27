// mision-voyager-transmision.js — «Código de Transmisión» (Voyager 1 & 2)
// Regla única: mirá la secuencia de señales y repetila tocando en el mismo
// orden. Voyager 1 está tan lejos que una señal tarda casi un día entero en
// llegar a la Tierra — no hay margen para pedir que la repitan, así que cada
// mensaje tiene que salir exactamente bien a la primera.
import { crearEntrada } from '../nucleo/entrada-unificada.js'
import { suscribir } from '../nucleo/bucle-animacion.js'
import { tono, ruido } from '../nucleo/audio-mision.js'
import { evaluarEstrellas } from '../nucleo/evaluador-estrellas.js'
import { crearAyuda, registrarDibujo } from '../nucleo/ayuda-paso-a-paso.js'

registrarDibujo('voy-mirar', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="60" r="16" fill="currentColor" opacity=".9"/>
    <circle cx="100" cy="60" r="16" stroke="currentColor" stroke-width="3" opacity=".4"/>
    <circle cx="150" cy="60" r="16" stroke="currentColor" stroke-width="3" opacity=".4"/>
    <path d="M50 90 L50 100" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".6"/>
  </svg>`)
registrarDibujo('voy-repetir', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="60" r="16" fill="currentColor" opacity=".9"/>
    <circle cx="100" cy="60" r="16" fill="currentColor" opacity=".55"/>
    <circle cx="150" cy="60" r="16" stroke="currentColor" stroke-width="3" opacity=".4"/>
    <g class="ayuda-dibujo-mano">
      <circle cx="100" cy="90" r="10" fill="currentColor" opacity=".2"/>
      <circle cx="100" cy="90" r="6" fill="currentColor"/>
    </g>
  </svg>`)

export const meta = {
  titulo: 'Voyager · Código de Transmisión',
  acento: '#818CF8',
  objetivo: 'Mirá la secuencia de señales y repetila tocando en el mismo orden.',
  datoInicial: 'Voyager manda sus mensajes a la Tierra como una secuencia exacta de señales — no hay margen de error, porque la señal tarda casi un día entero en llegar.',
  datoCierre: 'Voyager 1 está a más de 24.000 millones de km. Una señal de radio, viajando a la velocidad de la luz, tarda más de 22 horas en llegar hasta acá. Y aún así, la seguimos escuchando.',
}

const PARAMETROS_DIFICULTAD = {
  1: { posiciones: 3, longitud: 3 },
  2: { posiciones: 4, longitud: 4 },
  3: { posiciones: 5, longitud: 5 },
}

const DURACION_LUZ_MS = 550
const PAUSA_LUZ_MS = 280
const SEGUNDOS_PISTA_AUTOMATICA = 45

function crearAleatorio(semilla) {
  let estado = semilla >>> 0
  return function () {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// La secuencia nunca repite la misma posición dos veces seguidas — así cada
// paso de la señal siempre se ve como un cambio real, nunca "la misma luz
// quedó prendida".
function generarRonda(azar, config) {
  const n = config.posiciones
  const secuencia = []
  let anterior = -1
  for (let i = 0; i < config.longitud; i++) {
    let candidato
    do { candidato = Math.floor(azar() * n) } while (candidato === anterior)
    secuencia.push(candidato)
    anterior = candidato
  }
  return { posiciones: n, secuencia, fase: 'mostrando', indiceEntrada: 0, resuelto: false }
}

function generarSecuenciaRondas(dificultad) {
  const d = PARAMETROS_DIFICULTAD[dificultad]
  return [
    { posiciones: 3, longitud: 2 },
    { posiciones: 3, longitud: 3 },
    { posiciones: d.posiciones, longitud: d.longitud },
    { posiciones: d.posiciones, longitud: d.longitud },
  ]
}

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
  let quitarTeclado = null

  const secuenciaRondas = generarSecuenciaRondas(opciones.dificultad)
  let indiceRonda = 0
  let ronda = null
  let fallosReales = 0
  let tiempoInactividad = 0
  let manitaEl = null

  const estilo = document.createElement('style')
  estilo.textContent = CSS_JUEGO
  contenedor.appendChild(estilo)

  const raiz = document.createElement('div')
  raiz.className = 'voy-raiz'
  raiz.innerHTML = `
    <div class="voy-fila" role="group" aria-label="Señales de la transmisión"></div>
    <p class="voy-anuncio" aria-live="polite"></p>
  `
  contenedor.appendChild(raiz)

  const filaEl = raiz.querySelector('.voy-fila')
  const anuncioEl = raiz.querySelector('.voy-anuncio')
  const elementosLuz = []

  function anunciar(texto) {
    anuncioEl.textContent = texto
  }

  function construirFilaDOM() {
    elementosLuz.length = 0
    filaEl.innerHTML = ''
    for (let i = 0; i < ronda.posiciones; i++) {
      const boton = document.createElement('button')
      boton.type = 'button'
      boton.className = 'voy-luz'
      boton.dataset.i = String(i)
      boton.tabIndex = i === 0 ? 0 : -1
      boton.setAttribute('aria-label', `Señal ${i + 1} de ${ronda.posiciones}`)
      filaEl.appendChild(boton)
      elementosLuz.push(boton)
    }
  }

  function apagarLuces() {
    elementosLuz.forEach((el) => el.classList.remove('voy-luz--activa'))
  }

  function encenderLuz(i) {
    apagarLuces()
    elementosLuz[i]?.classList.add('voy-luz--activa')
    tono({ frecuencia: 340 + i * 70, duracion: DURACION_LUZ_MS / 1000 * .8, tipo: 'sine', ganancia: .18 })
    anunciar(`Señal ${i + 1}`)
  }

  // Reproduce el parpadeo completo de la secuencia y avisa al terminar —
  // no toca el estado de la ronda: eso lo decide quien la llama (arranque
  // de ronda, reintento tras un error, o la demo de la ayuda).
  function reproducirSecuenciaVisual(alTerminar) {
    let i = 0
    function paso() {
      if (destruido) return
      if (i >= ronda.secuencia.length) { apagarLuces(); alTerminar(); return }
      encenderLuz(ronda.secuencia[i])
      setTimeout(() => {
        if (destruido) return
        apagarLuces()
        i += 1
        setTimeout(paso, PAUSA_LUZ_MS)
      }, DURACION_LUZ_MS)
    }
    setTimeout(paso, 500)
  }

  function mostrarSecuencia() {
    quitarManita()
    ronda.fase = 'mostrando'
    reproducirSecuenciaVisual(() => {
      if (destruido) return
      ronda.fase = 'jugando'
      ronda.indiceEntrada = 0
      anunciar('Ahora repetila en el mismo orden.')
      if (indiceRonda === 0) mostrarManita(ronda.secuencia[0], { persistente: true })
    })
  }

  function quitarManita() {
    manitaEl?.remove()
    manitaEl = null
  }

  function mostrarManita(i, { persistente = false } = {}) {
    quitarManita()
    const boton = elementosLuz[i]
    if (!boton) return
    manitaEl = document.createElement('div')
    manitaEl.className = 'voy-manita'
    manitaEl.innerHTML = `
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="24" r="14" fill="currentColor" opacity=".25"/>
        <circle cx="30" cy="24" r="7" fill="currentColor"/>
      </svg>`
    boton.appendChild(manitaEl)
    if (!persistente) setTimeout(quitarManita, 2600)
  }

  function resaltarPistaLuz() {
    if (destruido || !ronda || ronda.resuelto || ronda.fase !== 'jugando') return
    mostrarManita(ronda.secuencia[ronda.indiceEntrada])
  }

  function reproducirAcierto(i) {
    const el = elementosLuz[i]
    el?.classList.add('voy-luz--acierto')
    setTimeout(() => el?.classList.remove('voy-luz--acierto'), 320)
    tono({ frecuencia: 520, duracion: .14, tipo: 'triangle', ganancia: .16 })
  }

  function reproducirFallo(i) {
    const el = elementosLuz[i]
    el?.classList.add('voy-luz--fallo')
    setTimeout(() => el?.classList.remove('voy-luz--fallo'), 320)
    ruido({ duracion: .18, filtro: 700, ganancia: .1 })
  }

  function manejarClicLuz(i) {
    if (destruido || pausado || !ronda || ronda.resuelto || ronda.fase !== 'jugando') return
    quitarManita()
    tiempoInactividad = 0
    ayuda?.marcarLogro()
    const esperado = ronda.secuencia[ronda.indiceEntrada]
    if (i === esperado) {
      reproducirAcierto(i)
      ronda.indiceEntrada += 1
      if (ronda.indiceEntrada >= ronda.secuencia.length) {
        ronda.resuelto = true
        anunciar('¡Mensaje transmitido!')
        emitir('progreso', (indiceRonda + 1) / secuenciaRondas.length)
        setTimeout(finalizarRonda, 900)
      }
    } else {
      if (indiceRonda >= 2) fallosReales += 1
      reproducirFallo(i)
      anunciar('Esa no era — mirá de nuevo la secuencia completa.')
      setTimeout(() => { if (!destruido) mostrarSecuencia() }, 600)
    }
  }

  function iniciarRonda() {
    quitarManita()
    ronda = generarRonda(azar, secuenciaRondas[indiceRonda])
    construirFilaDOM()
    tiempoInactividad = 0
    mostrarSecuencia()
  }

  function finalizarRonda() {
    quitarManita()
    if (indiceRonda >= secuenciaRondas.length - 1) {
      finalizarPartida()
    } else {
      indiceRonda += 1
      setTimeout(iniciarRonda, 700)
    }
  }

  function finalizarPartida() {
    const { estrellas } = evaluarEstrellas({
      metricas: { fallosReales },
      umbrales: [
        { estrellas: 1, descripcion: 'Transmitir el mensaje', condicion: () => true },
        { estrellas: 2, descripcion: 'Con pocos reintentos', condicion: (m) => m.fallosReales <= 2 },
        { estrellas: 3, descripcion: 'Sin un solo error', condicion: (m) => m.fallosReales === 0 },
      ],
    })
    emitir('superada', { estrellas, fallosReales })
  }

  function cuadro(dt) {
    if (pausado || destruido || !ronda) return
    if (ronda.fase === 'jugando' && !ronda.resuelto) {
      tiempoInactividad += dt
      if (tiempoInactividad >= SEGUNDOS_PISTA_AUTOMATICA) {
        tiempoInactividad = 0
        resaltarPistaLuz()
      }
    }
  }

  filaEl.addEventListener('click', (e) => {
    const boton = e.target.closest('.voy-luz')
    if (boton) manejarClicLuz(Number(boton.dataset.i))
  })

  entrada = crearEntrada(raiz)
  quitarTeclado = entrada.on('tecla-abajo', ({ tecla, original }) => {
    const activo = document.activeElement
    if (!activo?.classList?.contains('voy-luz')) return
    const i = Number(activo.dataset.i)
    if (tecla === ' ' || tecla === 'Enter') {
      original?.preventDefault?.()
      manejarClicLuz(i)
      return
    }
    if (tecla !== 'ArrowLeft' && tecla !== 'ArrowRight') return
    original?.preventDefault?.()
    const destino = i + (tecla === 'ArrowRight' ? 1 : -1)
    const elDestino = elementosLuz[destino]
    if (!elDestino) return
    activo.tabIndex = -1
    elDestino.tabIndex = 0
    elDestino.focus()
    anunciar(`Señal ${destino + 1} de ${ronda.posiciones}`)
  })

  const ayuda = crearAyuda(raiz, {
    id: 'voyager',
    pasos: [
      { texto: 'Mirá qué señales se prenden y en qué orden.', dibujo: 'voy-mirar' },
      { texto: 'Después, tocalas vos en ese mismo orden.', dibujo: 'voy-repetir' },
      { texto: 'Si te equivocás, no pasa nada: te la muestro de nuevo.', dibujo: 'meta' },
    ],
    alAbrir: () => { pausado = true },
    alCerrar: () => { pausado = false },
    demostrar: () => demostrar(),
    siguientePista: () => resaltarPistaLuz(),
  })

  function demostrar() {
    // Vuelve a mostrar la secuencia completa sin tocar el progreso de
    // entrada del jugador — al terminar, todo sigue exactamente como
    // estaba, así "ver un ejemplo" nunca puede resolver la ronda de verdad.
    if (!ronda || ronda.fase !== 'jugando') return
    pausado = true
    const entradaGuardada = ronda.indiceEntrada
    ronda.fase = 'mostrando'
    reproducirSecuenciaVisual(() => {
      if (destruido) return
      ronda.fase = 'jugando'
      ronda.indiceEntrada = entradaGuardada
      pausado = false
    })
  }

  return {
    iniciar() {
      iniciarRonda()
      quitarSuscripcion = suscribir(cuadro)
    },
    pausar() { pausado = true },
    reanudar() { pausado = false },
    destruir() {
      if (destruido) return
      destruido = true
      quitarSuscripcion?.()
      quitarTeclado?.()
      entrada?.destruir()
      ayuda.destruir()
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

const CSS_JUEGO = `
.voy-raiz {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--e-4, 1rem);
  width: 100%;
  height: 100%;
  color: #ecebff;
  font-family: inherit;
}
.voy-fila {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--e-4, 1rem);
  flex-wrap: wrap;
  padding: var(--e-4, 1rem);
}
.voy-luz {
  position: relative;
  width: clamp(56px, 14vw, 72px);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid rgba(129, 140, 248, .4);
  background: radial-gradient(circle, rgba(129,140,248,.14), rgba(10, 10, 24, .5));
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease, transform .15s ease;
}
.voy-luz:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.voy-luz--activa {
  background: radial-gradient(circle, #ecebff, #818CF8 70%);
  border-color: #ecebff;
  box-shadow: 0 0 22px rgba(129, 140, 248, .8);
  transform: scale(1.08);
}
.voy-luz--acierto {
  background: radial-gradient(circle, #eafffb, #5FD9C4 70%);
  border-color: #5FD9C4;
  box-shadow: 0 0 18px rgba(95, 217, 196, .7);
}
.voy-luz--fallo {
  background: radial-gradient(circle, #ffd7dd, #ff8fa3 70%);
  border-color: #ff8fa3;
  animation: voy-sacudir .32s ease;
}
@keyframes voy-sacudir {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.voy-manita {
  position: absolute;
  left: 50%; top: 0;
  transform: translate(-50%, -110%);
  width: 44px;
  height: 44px;
  color: #fff;
  pointer-events: none;
  animation: voy-manita-tap 1s ease-in-out infinite;
}
@keyframes voy-manita-tap {
  0%, 100% { transform: translate(-50%, -110%); }
  50% { transform: translate(-50%, -85%); }
}
.voy-anuncio { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
@media (prefers-reduced-motion: reduce) {
  .voy-luz, .voy-luz--fallo, .voy-manita { transition: none; animation: none !important; }
}
`
