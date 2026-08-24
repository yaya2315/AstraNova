// mision-webb-espejos.js — «Alinear Espejos» (James Webb)
// El espejo primario del Webb son 18 segmentos hexagonales independientes,
// cada uno movido por motores de precisión nanométrica hasta que las 18
// imágenes desenfocadas del mismo objeto se funden en una sola. Este juego
// es esa operación como puzzle de deducción espacial: pulsar un segmento
// cambia su fase y la de sus vecinos — hay que llevar TODOS los segmentos
// a la misma fase, sin importar cuál. Sin reloj: es un problema de lógica,
// no de reflejos.
import { suscribir } from '../nucleo/bucle-animacion.js'
import { crearEntrada } from '../nucleo/entrada-unificada.js'
import { tono, barrido } from '../nucleo/audio-mision.js'
import { evaluarEstrellas } from '../nucleo/evaluador-estrellas.js'

export const meta = {
  titulo: 'James Webb · Alinear Espejos',
  acento: '#9B7FE8',
  objetivo: 'Llevá todos los segmentos del espejo a la misma fase para fusionar las imágenes en una sola.',
  datoInicial: 'El espejo primario del James Webb está hecho de 18 segmentos hexagonales de berilio bañados en oro, cada uno ajustable con motores de precisión nanométrica.',
  datoCierre: 'Alinear los 18 segmentos reales del Webb tomó unos tres meses de ajustes microscópicos, hasta que las 18 imágenes borrosas de una misma estrella se fusionaron en un solo punto nítido.',
}

// ── Geometría hexagonal axial (orientación "flat-top") ───────────────────
const DIRECCIONES = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
// Mapeo físico Q W E / A S D → las 6 direcciones hexagonales, en la misma
// disposición espacial que las teclas ocupan en el teclado (Q arriba-izq,
// W arriba, E arriba-der, A abajo-izq, S abajo, D abajo-der).
const DIRECCION_TECLA = { q: [-1, 0], w: [0, -1], e: [1, -1], a: [-1, 1], s: [0, 1], d: [1, 0] }

const PARAMETROS_DIFICULTAD = {
  1: { incluirCentro: true, base: 3, k: 4, bloqueados: 0 },
  2: { incluirCentro: false, base: 4, k: 6, bloqueados: 0 },
  3: { incluirCentro: false, base: 6, k: 11, bloqueados: 2 },
}

function mod(n, m) {
  return ((n % m) + m) % m
}

// ── PRNG determinista (mulberry32) — misma semilla, mismo tablero ───────
function crearAleatorio(semilla) {
  let estado = semilla >>> 0
  return function () {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Anillo hexagonal a distancia `radio` del centro — algoritmo estándar:
// caminar 6 lados de `radio` pasos cada uno, arrancando en la dirección 4.
function anilloHex(radio) {
  if (radio === 0) return [{ q: 0, r: 0 }]
  const resultados = []
  let q = DIRECCIONES[4][0] * radio
  let r = DIRECCIONES[4][1] * radio
  for (let lado = 0; lado < 6; lado++) {
    for (let paso = 0; paso < radio; paso++) {
      resultados.push({ q, r })
      q += DIRECCIONES[lado][0]
      r += DIRECCIONES[lado][1]
    }
  }
  return resultados
}

function construirTablero(dificultad) {
  const params = PARAMETROS_DIFICULTAD[dificultad]
  const crudos = params.incluirCentro ? [{ q: 0, r: 0 }, ...anilloHex(1)] : [...anilloHex(1), ...anilloHex(2)]
  const idDe = (h) => `${h.q},${h.r}`
  const hexes = crudos.map((h) => ({ ...h, id: idDe(h) }))
  const idsValidos = new Set(hexes.map((h) => h.id))
  const vecinos = new Map()
  for (const h of hexes) {
    const propios = []
    for (const [dq, dr] of DIRECCIONES) {
      const id = `${h.q + dq},${h.r + dr}`
      if (idsValidos.has(id)) propios.push(id)
    }
    vecinos.set(h.id, propios)
  }
  return { hexes, vecinos, base: params.base, k: params.k, bloqueadosCount: params.bloqueados }
}

// Convierte coordenadas axiales a posición porcentual dentro de un
// contenedor con aspect-ratio ya calculado — así el panal se dibuja con
// DOM absolutamente posicionado (nada de canvas para los hexágonos, solo
// para el sensor), y escala con clamp()/aspect-ratio sin JS de resize.
function calcularLayoutHex(hexes) {
  const tam = 1
  const puntos = hexes.map((h) => ({
    id: h.id,
    x: tam * 1.5 * h.q,
    y: tam * (Math.sqrt(3) / 2 * h.q + Math.sqrt(3) * h.r),
  }))
  const minX = Math.min(...puntos.map((p) => p.x)) - tam
  const maxX = Math.max(...puntos.map((p) => p.x)) + tam
  const minY = Math.min(...puntos.map((p) => p.y)) - (tam * Math.sqrt(3)) / 2
  const maxY = Math.max(...puntos.map((p) => p.y)) + (tam * Math.sqrt(3)) / 2
  const rangoX = maxX - minX
  const rangoY = maxY - minY
  const anchoHexPct = ((tam * 2) / rangoX) * 100
  const altoHexPct = ((tam * Math.sqrt(3)) / rangoY) * 100
  const posiciones = new Map()
  for (const p of puntos) {
    posiciones.set(p.id, {
      leftPct: ((p.x - minX) / rangoX) * 100,
      topPct: ((p.y - minY) / rangoY) * 100,
      anchoHexPct,
      altoHexPct,
    })
  }
  return { posiciones, aspecto: rangoX / rangoY }
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
  let resuelto = false
  let quitarSuscripcion = null
  let entrada = null
  let quitarTeclado = null

  const tablero = construirTablero(opciones.dificultad)
  const layout = calcularLayoutHex(tablero.hexes)

  // Nunca se generan estados al azar (podrían ser irresolubles): se parte
  // del estado uniforme (todos en fase 0, que YA es una solución válida) y
  // se aplican K pulsaciones aleatorias — eso garantiza que existe un
  // camino de vuelta. Los bloqueados se eligen ANTES de mezclar y el
  // mezclado nunca los usa directamente, así el puzzle queda garantizado
  // resoluble usando solo los segmentos que el jugador puede pulsar.
  const fases = new Map(tablero.hexes.map((h) => [h.id, 0]))
  const contadorClicks = new Map(tablero.hexes.map((h) => [h.id, 0]))
  const bloqueados = new Set()
  {
    const candidatos = tablero.hexes.map((h) => h.id)
    for (let i = 0; i < tablero.bloqueadosCount; i++) {
      const idx = Math.floor(azar() * candidatos.length)
      bloqueados.add(candidatos.splice(idx, 1)[0])
    }
  }
  const idsPulsables = tablero.hexes.map((h) => h.id).filter((id) => !bloqueados.has(id))

  function aplicarPulsoBruto(id) {
    fases.set(id, mod(fases.get(id) + 1, tablero.base))
    for (const vecino of tablero.vecinos.get(id)) {
      fases.set(vecino, mod(fases.get(vecino) + 1, tablero.base))
    }
  }

  for (let i = 0; i < tablero.k; i++) {
    const id = idsPulsables[Math.floor(azar() * idsPulsables.length)]
    aplicarPulsoBruto(id)
    contadorClicks.set(id, contadorClicks.get(id) + 1)
  }

  // "Óptimo conocido": cuántas pulsaciones adicionales, una por segmento,
  // devuelven el tablero a fase 0 exacta desde el estado recién mezclado.
  // Es la base contra la que se puntúan las estrellas del jugador.
  function calcularCorreccion() {
    const correccion = new Map()
    for (const h of tablero.hexes) correccion.set(h.id, mod(tablero.base - mod(contadorClicks.get(h.id), tablero.base), tablero.base))
    return correccion
  }
  const optimo = [...calcularCorreccion().values()].reduce((a, b) => a + b, 0)

  let pulsacionesJugador = 0
  const historialClicks = []
  let tiempoInactividad = 0
  let convergenciaVisual = 0
  let estrellasGalaxia = null

  function estaTodoIgual() {
    const valores = [...fases.values()]
    return valores.every((v) => v === valores[0])
  }

  function calcularConvergencia() {
    let sumaCos = 0, sumaSin = 0
    for (const v of fases.values()) {
      const angulo = (2 * Math.PI * v) / tablero.base
      sumaCos += Math.cos(angulo)
      sumaSin += Math.sin(angulo)
    }
    const n = fases.size
    return Math.sqrt(sumaCos * sumaCos + sumaSin * sumaSin) / n
  }

  // -- construcción del DOM --
  const estilo = document.createElement('style')
  estilo.textContent = CSS_JUEGO
  contenedor.appendChild(estilo)

  const raiz = document.createElement('div')
  raiz.className = 'mwe-raiz'
  raiz.innerHTML = plantilla(tablero, layout, bloqueados, opciones.modoAccesible)
  contenedor.appendChild(raiz)

  const panalEl = raiz.querySelector('.mwe-panal')
  const elementosHex = new Map()
  raiz.querySelectorAll('.mwe-hex').forEach((el) => elementosHex.set(el.dataset.id, el))
  const primerHex = elementosHex.get(tablero.hexes[0].id)
  if (primerHex) primerHex.tabIndex = 0

  let canvasSensor, ctxSensor
  function redimensionarCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const r = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(r.width * dpr))
    canvas.height = Math.max(1, Math.round(r.height * dpr))
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function actualizarVisualHexes() {
    for (const h of tablero.hexes) {
      const el = elementosHex.get(h.id)
      if (!el) continue
      const fase = fases.get(h.id)
      el.style.setProperty('--mwe-anillo', String(fase / tablero.base))
      el.style.setProperty('--mwe-brillo', String(0.22 + (fase / tablero.base) * 0.6))
      const etiqueta = el.querySelector('.mwe-hex-fase')
      if (etiqueta) etiqueta.textContent = String(fase)
    }
  }

  function actualizarHud() {
    const hud = raiz.querySelector('.mwe-hud')
    if (hud) hud.textContent = `Pulsaciones: ${pulsacionesJugador}`
  }

  function actualizarBotonDeshacer() {
    const boton = raiz.querySelector('[data-accion="deshacer"]')
    if (boton) boton.disabled = historialClicks.length === 0
  }

  function animarOnda(idOrigen) {
    const origen = elementosHex.get(idOrigen)
    origen?.classList.add('mwe-hex--onda')
    setTimeout(() => origen?.classList.remove('mwe-hex--onda'), 240)
    const vecinos = tablero.vecinos.get(idOrigen) || []
    vecinos.forEach((vId) => {
      const el = elementosHex.get(vId)
      if (!el) return
      setTimeout(() => {
        el.classList.add('mwe-hex--onda-vecino')
        setTimeout(() => el.classList.remove('mwe-hex--onda-vecino'), 240)
      }, 40)
    })
  }

  function manejarClicHex(id) {
    if (destruido || pausado || resuelto || bloqueados.has(id)) return
    aplicarPulsoBruto(id)
    contadorClicks.set(id, contadorClicks.get(id) + 1)
    pulsacionesJugador += 1
    historialClicks.push(id)
    tiempoInactividad = 0
    animarOnda(id)
    actualizarVisualHexes()
    actualizarHud()
    actualizarBotonDeshacer()
    tono({ frecuencia: 220 + fases.get(id) * 40, duracion: 0.08, tipo: 'sine', ganancia: 0.12 })
    emitir('progreso', calcularConvergencia())
    if (estaTodoIgual()) finalizar()
  }

  function deshacer() {
    if (!opciones.modoAccesible || historialClicks.length === 0 || resuelto) return
    const id = historialClicks.pop()
    // Aplicar el mismo pulso (base-1) veces más equivale a restarle 1 mod
    // base — inversa exacta sin necesitar una operación "resta" separada.
    for (let i = 0; i < tablero.base - 1; i++) aplicarPulsoBruto(id)
    contadorClicks.set(id, contadorClicks.get(id) - 1)
    pulsacionesJugador = Math.max(0, pulsacionesJugador - 1)
    tiempoInactividad = 0
    actualizarVisualHexes()
    actualizarHud()
    actualizarBotonDeshacer()
  }

  function mostrarPista() {
    const correccion = calcularCorreccion()
    const candidato = tablero.hexes.find((h) => !bloqueados.has(h.id) && correccion.get(h.id) > 0)
    if (!candidato) return
    const el = elementosHex.get(candidato.id)
    el?.classList.add('mwe-hex--pista')
    setTimeout(() => el?.classList.remove('mwe-hex--pista'), 2200)
    const texto = raiz.querySelector('.mwe-pista')
    if (texto) texto.textContent = 'Pista: el segmento resaltado necesita otra pulsación.'
  }

  function finalizar() {
    resuelto = true
    barrido({ desde: 300, hasta: 900, duracion: 1.1, tipo: 'sine', ganancia: 0.16 })
    const { estrellas } = evaluarEstrellas({
      metricas: { pulsacionesJugador },
      umbrales: [
        { estrellas: 1, descripcion: 'Completar el alineado', condicion: () => true },
        { estrellas: 2, descripcion: `${optimo + 6} pulsaciones o menos`, condicion: (m) => m.pulsacionesJugador <= optimo + 6 },
        { estrellas: 3, descripcion: `${optimo + 2} pulsaciones o menos (óptimo + 2)`, condicion: (m) => m.pulsacionesJugador <= optimo + 2 },
      ],
    })
    emitir('superada', { estrellas, pulsacionesJugador, optimo })
  }

  function dibujarGalaxia(w, h) {
    if (!estrellasGalaxia) {
      const az = crearAleatorio((opciones.semilla >>> 0 || 1) + 777)
      estrellasGalaxia = Array.from({ length: 140 }, () => ({
        x: az() * w, y: az() * h, r: az() * 1.4 + 0.3, brillo: az() * 0.6 + 0.3,
      }))
    }
    ctxSensor.fillStyle = 'rgba(8,6,16,0.9)'
    ctxSensor.fillRect(0, 0, w, h)
    for (const s of estrellasGalaxia) {
      ctxSensor.beginPath()
      ctxSensor.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctxSensor.fillStyle = `rgba(200,190,255,${s.brillo})`
      ctxSensor.fill()
    }
  }

  function dibujarSensor() {
    const w = canvasSensor.clientWidth
    const h = canvasSensor.clientHeight
    ctxSensor.clearRect(0, 0, w, h)
    if (resuelto && convergenciaVisual > 0.98) {
      dibujarGalaxia(w, h)
      return
    }
    const cx = w / 2, cy = h / 2
    for (const h2 of tablero.hexes) {
      const pos = layout.posiciones.get(h2.id)
      const bx = (pos.leftPct / 100) * w
      const by = (pos.topPct / 100) * h
      const x = bx + (cx - bx) * convergenciaVisual
      const y = by + (cy - by) * convergenciaVisual
      const fase = fases.get(h2.id)
      const intensidad = 0.35 + (fase / tablero.base) * 0.65
      ctxSensor.beginPath()
      ctxSensor.arc(x, y, 3 + convergenciaVisual * 2, 0, Math.PI * 2)
      ctxSensor.fillStyle = `rgba(155,127,232,${intensidad})`
      ctxSensor.fill()
    }
  }

  function cuadro(dt) {
    if (pausado) return
    const objetivo = calcularConvergencia()
    convergenciaVisual += (objetivo - convergenciaVisual) * Math.min(1, dt * 6)
    dibujarSensor()

    if (opciones.modoAccesible && !resuelto) {
      tiempoInactividad += dt
      if (tiempoInactividad >= 45) {
        tiempoInactividad = 0
        mostrarPista()
      }
    }
  }

  panalEl.addEventListener('click', (e) => {
    const boton = e.target.closest('.mwe-hex')
    if (boton) manejarClicHex(boton.dataset.id)
  })
  raiz.querySelector('[data-accion="deshacer"]')?.addEventListener('click', deshacer)

  entrada = crearEntrada(raiz)
  quitarTeclado = entrada.on('tecla-abajo', ({ tecla, original }) => {
    const activo = document.activeElement
    if (!activo || !activo.classList?.contains('mwe-hex')) return
    // Activación explícita en vez de depender del comportamiento nativo del
    // <button> con Espacio/Enter: algunos entornos de entrada sintética no
    // disparan el "click" por defecto del navegador, y el contrato exige
    // una ruta de teclado que funcione siempre, no solo cuando el navegador
    // decide activarla.
    if (tecla === ' ' || tecla === 'Enter') {
      original?.preventDefault?.()
      manejarClicHex(activo.dataset.id)
      return
    }
    const dir = DIRECCION_TECLA[tecla]
    if (!dir) return
    const [q, r] = activo.dataset.id.split(',').map(Number)
    const destino = elementosHex.get(`${q + dir[0]},${r + dir[1]}`)
    if (destino) {
      activo.tabIndex = -1
      destino.tabIndex = 0
      destino.focus()
    }
  })

  actualizarVisualHexes()
  actualizarHud()
  actualizarBotonDeshacer()

  // ── contrato ──────────────────────────────────────────────────────────
  return {
    iniciar() {
      canvasSensor = raiz.querySelector('.mwe-sensor')
      redimensionarCanvas(canvasSensor)
      ctxSensor = canvasSensor.getContext('2d')
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

// ── Plantilla de DOM ──────────────────────────────────────────────────────
function plantilla(tablero, layout, bloqueados, modoAccesible) {
  const anchoMinimo = tablero.hexes.length > 10 ? 460 : 300
  return `
    <div class="mwe-zona-panal">
      <div class="mwe-panal" role="group" aria-label="Panal de espejos" style="aspect-ratio:${layout.aspecto};min-width:${anchoMinimo}px">
        ${tablero.hexes.map((h) => {
          const pos = layout.posiciones.get(h.id)
          const esBloqueado = bloqueados.has(h.id)
          return `
          <button type="button" class="mwe-hex${esBloqueado ? ' mwe-hex--bloqueado' : ''}" data-id="${h.id}" tabindex="-1"
            style="left:${pos.leftPct}%;top:${pos.topPct}%;width:${pos.anchoHexPct}%;height:${pos.altoHexPct}%"
            aria-label="Segmento ${h.id}${esBloqueado ? ', bloqueado — solo cambia por sus vecinos' : ''}"
            ${esBloqueado ? 'aria-disabled="true"' : ''}>
            <span class="mwe-hex-anillo"></span>
            <span class="mwe-hex-fase"></span>
          </button>`
        }).join('')}
      </div>
      <p class="mwe-instrucciones">Pulsá un segmento: suma fase a él y a sus vecinos. Llevá todos los segmentos a la misma fase. Teclado: <kbd>Q W E</kbd> / <kbd>A S D</kbd> para moverte entre segmentos, <kbd>Espacio</kbd> para pulsar.</p>
      ${modoAccesible ? `
        <div class="mwe-controles-accesibles">
          <button type="button" class="mwe-boton-deshacer" data-accion="deshacer" disabled>DESHACER</button>
          <p class="mwe-pista" aria-live="polite"></p>
        </div>` : ''}
    </div>
    <div class="mwe-zona-sensor">
      <canvas class="mwe-sensor"></canvas>
      <p class="mwe-etiqueta-sensor">SENSOR DE FRENTE DE ONDA</p>
    </div>
    <p class="mwe-hud" aria-live="polite"></p>
  `
}

// ── CSS del juego (inyectado y removido junto con el contenedor) ────────
const CSS_JUEGO = `
.mwe-raiz {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--e-4, 1rem);
  width: 100%;
  height: 100%;
  color: #f1ecff;
  font-family: inherit;
}
@media (min-width: 720px) {
  .mwe-raiz { grid-template-columns: 7fr 3fr; grid-template-rows: 1fr auto; align-items: start; }
  .mwe-zona-panal { grid-column: 1; grid-row: 1; }
  .mwe-zona-sensor { grid-column: 2; grid-row: 1; }
  .mwe-hud { grid-column: 1 / -1; grid-row: 2; }
}
.mwe-zona-panal {
  display: flex;
  flex-direction: column;
  gap: var(--e-3, .75rem);
  min-width: 0;
  overflow-x: auto;
  padding: var(--e-2, .5rem);
}
.mwe-panal {
  position: relative;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}
.mwe-hex {
  position: absolute;
  transform: translate(-50%, -50%);
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
  border: none;
  min-width: 44px;
  min-height: 38px;
  background: rgba(155, 127, 232, var(--mwe-brillo, .28));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background .18s ease;
}
.mwe-hex:focus-visible { outline: 2px solid var(--acento-mision, #9B7FE8); outline-offset: 3px; }
.mwe-hex--bloqueado { cursor: not-allowed; opacity: .5; }
.mwe-hex--bloqueado::before {
  content: '🔒';
  position: absolute;
  top: 2px;
  font-size: .6rem;
}
.mwe-hex--onda, .mwe-hex--onda-vecino { border: 2px solid var(--acento-mision, #9B7FE8); }
.mwe-hex--onda { animation: mwe-onda .24s cubic-bezier(.2,.8,.2,1); }
.mwe-hex--onda-vecino { animation: mwe-onda-vecino .24s cubic-bezier(.2,.8,.2,1); }
@keyframes mwe-onda {
  0% { transform: translate(-50%, -50%) scale(1); }
  40% { transform: translate(-50%, -50%) scale(1.16); }
  100% { transform: translate(-50%, -50%) scale(1); }
}
@keyframes mwe-onda-vecino {
  0% { opacity: .75; }
  50% { opacity: 1; }
  100% { opacity: .75; }
}
.mwe-hex--pista { box-shadow: 0 0 0 3px var(--acento-mision, #9B7FE8), 0 0 16px var(--acento-mision, #9B7FE8); }
.mwe-hex-anillo {
  position: absolute;
  inset: 18%;
  border-radius: 50%;
  background: conic-gradient(var(--acento-mision, #9B7FE8) calc(var(--mwe-anillo, 0) * 360deg), rgba(255,255,255,.14) 0);
  pointer-events: none;
}
.mwe-hex-fase {
  position: relative;
  font-size: .7rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,.6);
  pointer-events: none;
}
.mwe-instrucciones {
  font-size: var(--hud-label, .75rem);
  color: rgba(255,255,255,.6);
  text-align: center;
  margin: 0;
}
.mwe-instrucciones kbd {
  font: inherit;
  padding: 0 .3em;
  border: 1px solid rgba(255,255,255,.25);
  border-radius: .25em;
}
.mwe-controles-accesibles {
  display: flex;
  align-items: center;
  gap: var(--e-3, .75rem);
  flex-wrap: wrap;
  justify-content: center;
}
.mwe-boton-deshacer {
  min-height: 44px;
  padding: 0 var(--e-4, 1rem);
  border-radius: .5rem;
  border: 1px solid var(--acento-mision, #9B7FE8);
  background: rgba(155,127,232,.14);
  color: #fff;
  cursor: pointer;
}
.mwe-boton-deshacer:disabled { opacity: .4; cursor: not-allowed; }
.mwe-pista {
  font-size: var(--hud-label, .75rem);
  color: var(--acento-mision, #9B7FE8);
  margin: 0;
  min-height: 1.2em;
}
.mwe-zona-sensor {
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgba(14, 10, 24, .5);
  border-radius: .75rem;
  padding: var(--e-3, .75rem);
  min-height: 160px;
}
.mwe-sensor { flex: 1; width: 100%; border-radius: .5rem; }
.mwe-etiqueta-sensor {
  margin: var(--e-2, .5rem) 0 0;
  font-size: var(--hud-label, .75rem);
  letter-spacing: .1em;
  text-transform: uppercase;
  color: rgba(255,255,255,.5);
  text-align: center;
}
.mwe-hud {
  text-align: center;
  font-size: var(--hud-label, .75rem);
  color: rgba(255,255,255,.6);
  letter-spacing: .06em;
  margin: 0;
}
@media (prefers-reduced-motion: reduce) {
  .mwe-hex, .mwe-hex--onda, .mwe-hex--onda-vecino { animation: none; transition: none; }
}
`
