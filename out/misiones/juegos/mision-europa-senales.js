// mision-europa-senales.js — «Sondeo de Hielo» (Europa Clipper)
// Regla única: tocá la columna donde el hielo es más fino. El radar REASON
// hace justo eso — mide cuánto tarda el eco en volver desde el fondo del
// hielo, y donde el eco vuelve más rápido es donde el hielo es más delgado
// y el océano subglacial está más cerca de la superficie.
import { suscribir } from '../nucleo/bucle-animacion.js'
import { crearEntrada } from '../nucleo/entrada-unificada.js'
import { tono, ruido } from '../nucleo/audio-mision.js'
import { evaluarEstrellas } from '../nucleo/evaluador-estrellas.js'
import { crearAyuda, registrarDibujo } from '../nucleo/ayuda-paso-a-paso.js'

// Dibujos específicos de este juego para el panel de ayuda.
registrarDibujo('ees-comparar', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="40" y="30" width="26" height="70" rx="3" fill="currentColor" opacity=".35"/>
    <rect x="87" y="66" width="26" height="34" rx="3" fill="currentColor"/>
    <rect x="134" y="46" width="26" height="54" rx="3" fill="currentColor" opacity=".35"/>
    <path d="M100 108 L100 116" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path d="M92 112 L100 118 L108 112" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`)
registrarDibujo('ees-oceano', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="70" y="20" width="60" height="24" rx="3" fill="currentColor" opacity=".85"/>
    <rect x="20" y="44" width="160" height="56" rx="4" fill="currentColor" opacity=".18"/>
    <circle class="ayuda-dibujo-onda ayuda-dibujo-onda1" cx="100" cy="72" r="10" stroke="currentColor" stroke-width="2.5" opacity=".7"/>
    <circle class="ayuda-dibujo-onda ayuda-dibujo-onda2" cx="100" cy="72" r="18" stroke="currentColor" stroke-width="2.5" opacity=".35"/>
  </svg>`)

export const meta = {
  titulo: 'Europa Clipper · Sondeo de Hielo',
  acento: '#5FD9C4',
  objetivo: 'Tocá la columna donde el hielo es más fino.',
  datoInicial: 'El radar REASON de Europa Clipper mide cuánto tarda en volver el eco desde el fondo del hielo — más rápido el eco, más fino el hielo.',
  datoCierre: 'El hielo de Europa puede tener hasta 30 km de espesor. Los científicos buscan justo los puntos más finos: ahí el océano escondido debajo está más cerca de la superficie.',
}

const PARAMETROS_DIFICULTAD = {
  1: { columnas: 5, brecha: 0.32 },
  2: { columnas: 7, brecha: 0.18 },
  3: { columnas: 9, brecha: 0.09 },
}

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

// Nunca alturas totalmente al azar: se fija primero cuál columna es la más
// fina y recién después se generan las demás, todas por encima de ella por
// al menos `brecha` — así siempre hay una única respuesta correcta y nunca
// un empate imposible de resolver a ojo.
function generarRonda(azar, config) {
  const n = config.columnas
  const posicionFina = Math.floor(azar() * n)
  const alturas = new Array(n)
  alturas[posicionFina] = 0.12 + azar() * 0.1
  for (let i = 0; i < n; i++) {
    if (i === posicionFina) continue
    const piso = alturas[posicionFina] + config.brecha
    alturas[i] = Math.min(1, piso + azar() * (1 - piso))
  }
  return { alturas, posicionFina, resuelto: false }
}

function generarSecuenciaRondas(dificultad) {
  const d = PARAMETROS_DIFICULTAD[dificultad]
  return [
    { columnas: 3, brecha: 0.55 },
    { columnas: 4, brecha: 0.4 },
    { columnas: d.columnas, brecha: d.brecha },
    { columnas: d.columnas, brecha: d.brecha },
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
  raiz.className = 'ees-raiz'
  raiz.innerHTML = `
    <div class="ees-columnas" role="group" aria-label="Corte del hielo de Europa"></div>
    <p class="ees-anuncio" aria-live="polite"></p>
  `
  contenedor.appendChild(raiz)

  const columnasEl = raiz.querySelector('.ees-columnas')
  const anuncioEl = raiz.querySelector('.ees-anuncio')
  const elementosColumna = []

  function anunciar(texto) {
    anuncioEl.textContent = texto
  }

  function nivelGrosor(altura) {
    return Math.max(1, Math.min(10, Math.round(altura * 10)))
  }

  function construirColumnasDOM() {
    elementosColumna.length = 0
    columnasEl.innerHTML = ronda.alturas.map((_, i) => `
      <button type="button" class="ees-columna" data-i="${i}" tabindex="${i === 0 ? 0 : -1}">
        <span class="ees-hielo"></span>
        <span class="ees-manita-slot"></span>
      </button>`).join('')
    columnasEl.querySelectorAll('.ees-columna').forEach((el) => elementosColumna.push(el))
    pintarColumnas()
  }

  function pintarColumnas() {
    ronda.alturas.forEach((altura, i) => {
      const el = elementosColumna[i]
      if (!el) return
      el.querySelector('.ees-hielo').style.height = `${altura * 100}%`
      el.setAttribute('aria-label', `Columna ${i + 1}, grosor de hielo ${nivelGrosor(altura)} de 10`)
      el.classList.toggle('ees-columna--resuelta', !!ronda.resuelto && i === ronda.posicionFina)
    })
  }

  function quitarManita() {
    manitaEl?.remove()
    manitaEl = null
  }

  function mostrarManita(i, { persistente = false } = {}) {
    quitarManita()
    const slot = elementosColumna[i]?.querySelector('.ees-manita-slot')
    if (!slot) return
    manitaEl = document.createElement('div')
    manitaEl.className = 'ees-manita'
    manitaEl.innerHTML = `
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="24" r="14" fill="currentColor" opacity=".25"/>
        <circle cx="30" cy="24" r="7" fill="currentColor"/>
      </svg>`
    slot.appendChild(manitaEl)
    if (!persistente) setTimeout(quitarManita, 2600)
  }

  function resaltarPistaColumna() {
    if (destruido || !ronda || ronda.resuelto) return
    mostrarManita(ronda.posicionFina)
  }

  function reproducirAcierto(i) {
    const el = elementosColumna[i]
    el?.classList.add('ees-columna--pulso')
    setTimeout(() => el?.classList.remove('ees-columna--pulso'), 900)
    tono({ frecuencia: 520, duracion: .18, tipo: 'triangle', ganancia: .18 })
    setTimeout(() => tono({ frecuencia: 780, duracion: .22, tipo: 'sine', ganancia: .16 }), 90)
  }

  function reproducirFallo(i) {
    const el = elementosColumna[i]
    el?.classList.add('ees-columna--fallo')
    setTimeout(() => el?.classList.remove('ees-columna--fallo'), 320)
    ruido({ duracion: .2, filtro: 700, ganancia: .1 })
  }

  function manejarClicColumna(i) {
    if (destruido || pausado || !ronda || ronda.resuelto) return
    quitarManita()
    tiempoInactividad = 0
    ayuda?.marcarLogro()
    if (i === ronda.posicionFina) {
      ronda.resuelto = true
      pintarColumnas()
      reproducirAcierto(i)
      anunciar('¡Ahí! Ese es el punto más fino.')
      emitir('progreso', (indiceRonda + 1) / secuenciaRondas.length)
      setTimeout(finalizarRonda, 900)
    } else {
      if (indiceRonda >= 2) fallosReales += 1
      reproducirFallo(i)
      anunciar('Ahí no — probá con otra columna.')
    }
  }

  function iniciarRonda() {
    quitarManita()
    ronda = generarRonda(azar, secuenciaRondas[indiceRonda])
    construirColumnasDOM()
    tiempoInactividad = 0
    if (indiceRonda === 0) {
      // La primera pasada siempre señala la respuesta desde el principio —
      // así se enseña la regla completa sin decir una palabra.
      mostrarManita(ronda.posicionFina, { persistente: true })
    }
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
        { estrellas: 1, descripcion: 'Encontrarlo', condicion: () => true },
        { estrellas: 2, descripcion: 'Con pocos intentos de más', condicion: (m) => m.fallosReales <= 2 },
        { estrellas: 3, descripcion: 'A la primera en las dos pasadas reales', condicion: (m) => m.fallosReales === 0 },
      ],
    })
    emitir('superada', { estrellas, fallosReales })
  }

  function cuadro(dt) {
    if (pausado || destruido || !ronda) return
    if (!ronda.resuelto) {
      tiempoInactividad += dt
      if (tiempoInactividad >= SEGUNDOS_PISTA_AUTOMATICA) {
        tiempoInactividad = 0
        resaltarPistaColumna()
      }
    }
  }

  columnasEl.addEventListener('click', (e) => {
    const boton = e.target.closest('.ees-columna')
    if (boton) manejarClicColumna(Number(boton.dataset.i))
  })

  entrada = crearEntrada(raiz)
  quitarTeclado = entrada.on('tecla-abajo', ({ tecla, original }) => {
    const activo = document.activeElement
    if (!activo?.classList?.contains('ees-columna')) return
    const i = Number(activo.dataset.i)
    if (tecla === ' ' || tecla === 'Enter') {
      original?.preventDefault?.()
      manejarClicColumna(i)
      return
    }
    if (tecla !== 'ArrowLeft' && tecla !== 'ArrowRight') return
    original?.preventDefault?.()
    const destino = i + (tecla === 'ArrowRight' ? 1 : -1)
    const elDestino = elementosColumna[destino]
    if (!elDestino) return
    activo.tabIndex = -1
    elDestino.tabIndex = 0
    elDestino.focus()
    anunciar(`Columna ${destino + 1}, grosor de hielo ${nivelGrosor(ronda.alturas[destino])} de 10`)
  })

  const ayuda = crearAyuda(raiz, {
    id: 'europa',
    pasos: [
      { texto: 'Tocá la columna donde el hielo es más fino.', dibujo: 'ees-comparar' },
      { texto: 'La más fina es la más cortita: ahí el océano está más cerca de la superficie.', dibujo: 'ees-oceano' },
      { texto: 'Encontrala en cada pasada del radar.', dibujo: 'meta' },
    ],
    alAbrir: () => { pausado = true },
    alCerrar: () => { pausado = false },
    demostrar: () => demostrar(),
    siguientePista: () => resaltarPistaColumna(),
  })

  function demostrar() {
    // Solo una vista previa: nunca llama al manejador real, así que no hay
    // forma de que "ver un ejemplo" resuelva la ronda de verdad.
    pausado = true
    const i = ronda.posicionFina
    mostrarManita(i, { persistente: true })
    setTimeout(() => {
      if (destruido) return
      const el = elementosColumna[i]
      el?.classList.add('ees-columna--pulso')
      tono({ frecuencia: 520, duracion: .18, tipo: 'triangle', ganancia: .14 })
      setTimeout(() => {
        if (destruido) return
        el?.classList.remove('ees-columna--pulso')
        quitarManita()
        pausado = false
      }, 1000)
    }, 900)
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
.ees-raiz {
  display: flex;
  flex-direction: column;
  gap: var(--e-4, 1rem);
  width: 100%;
  height: 100%;
  color: #eafffb;
  font-family: inherit;
}
.ees-columnas {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: var(--e-2, .5rem);
  min-height: clamp(160px, 32vh, 240px);
  padding: var(--e-3, .75rem);
  background: linear-gradient(180deg, rgba(10,20,24,.35), rgba(6,30,46,.7));
  border-radius: var(--e-3, .75rem);
}
.ees-columna {
  position: relative;
  flex: 1;
  min-width: 32px;
  height: 100%;
  border: none;
  border-radius: .4rem;
  background: rgba(8, 40, 58, .8);
  cursor: pointer;
  overflow: visible;
  padding: 0;
}
.ees-columna:focus-visible { outline: 2px solid #5FD9C4; outline-offset: 3px; }
.ees-hielo {
  position: absolute;
  top: 0; left: 0; right: 0;
  border-radius: .4rem .4rem 0 0;
  background: linear-gradient(180deg, #eafffb, #a8e6dd 70%, #5FD9C4);
  transition: height .25s ease;
}
.ees-columna--fallo .ees-hielo { background: linear-gradient(180deg, #ffd7dd, #ff8fa3); }
.ees-columna--fallo { animation: ees-sacudir .32s ease; }
@keyframes ees-sacudir {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.ees-columna--pulso { animation: ees-pulso .9s ease; }
.ees-columna--resuelta .ees-hielo { background: linear-gradient(180deg, #fff7e0, #ffe6a8, #F5C84C); }
@keyframes ees-pulso {
  0% { box-shadow: 0 0 0 0 rgba(95,217,196,.6); }
  60% { box-shadow: 0 0 0 18px rgba(95,217,196,0); }
  100% { box-shadow: 0 0 0 0 rgba(95,217,196,0); }
}
.ees-manita-slot {
  position: absolute;
  top: 0; left: 50%;
  width: 0; height: 0;
}
.ees-manita {
  position: absolute;
  transform: translate(-50%, -110%);
  width: 52px;
  height: 52px;
  color: #fff;
  pointer-events: none;
  animation: ees-manita-tap 1s ease-in-out infinite;
  z-index: 3;
}
@keyframes ees-manita-tap {
  0%, 100% { transform: translate(-50%, -110%); }
  50% { transform: translate(-50%, -85%); }
}
.ees-anuncio {
  position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0);
}
@media (prefers-reduced-motion: reduce) {
  .ees-columna--fallo, .ees-columna--pulso, .ees-manita { animation: none !important; }
  .ees-hielo { transition: none; }
}
`
