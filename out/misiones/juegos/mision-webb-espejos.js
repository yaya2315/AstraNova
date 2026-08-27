// mision-webb-espejos.js — «Alinear Espejos» (James Webb)
// Regla única: todos los espejos tienen que quedar del mismo color. Cuando
// tocás uno, sus vecinos también cambian. Se resuelve pensando (probando
// combinaciones) o simplemente mirando la galaxia de al lado: se enfoca
// sola mientras más parejos quedan los espejos, así que también se puede
// jugar a ojo, sin entender nada de lógica.
import { suscribir } from '../nucleo/bucle-animacion.js'
import { crearEntrada } from '../nucleo/entrada-unificada.js'
import { tono, barrido } from '../nucleo/audio-mision.js'
import { evaluarEstrellas } from '../nucleo/evaluador-estrellas.js'
import { crearAyuda, registrarDibujo } from '../nucleo/ayuda-paso-a-paso.js'

// Dibujos específicos de este juego para el panel de ayuda — se suman al
// catálogo compartido (arrastrar/tocar/esperar/meta viven en el núcleo).
registrarDibujo('mwe-vecinos', () => {
  const centro = { x: 100, y: 60 }
  const radio = 30
  let satelites = ''
  for (let i = 0; i < 6; i++) {
    const angulo = (Math.PI / 3) * i
    const x = centro.x + Math.cos(angulo) * radio
    const y = centro.y + Math.sin(angulo) * radio
    satelites += `<line x1="${centro.x}" y1="${centro.y}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-width="2" opacity=".35"/>`
    satelites += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="currentColor" opacity=".85"/>`
  }
  return `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">${satelites}<circle cx="${centro.x}" cy="${centro.y}" r="12" fill="currentColor"/></svg>`
})
registrarDibujo('mwe-galaxia-clara', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="60" r="26" fill="currentColor" opacity=".15"/>
    <circle cx="50" cy="60" r="18" fill="currentColor" opacity=".2"/>
    <circle cx="50" cy="60" r="10" fill="currentColor" opacity=".3"/>
    <path d="M84 60 H124" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".5"/>
    <path d="M112 50 L126 60 L112 70" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>
    <path d="M155 44 L162 58 L178 60 L166 70 L169 86 L155 78 L141 86 L144 70 L132 60 L148 58 Z" fill="currentColor"/>
  </svg>`)

export const meta = {
  titulo: 'James Webb · Alinear Espejos',
  acento: '#9B7FE8',
  objetivo: 'Dejá todos los espejos del mismo color. Al tocar uno, sus vecinos cambian con él.',
  datoInicial: 'El telescopio James Webb ve el universo con 18 espejos dorados que tienen que quedar perfectamente alineados.',
  datoCierre: 'El telescopio James Webb tiene 18 espejos hexagonales. Alinearlos tomó tres meses. Hasta que quedaron perfectos, veía cada estrella 18 veces.',
}

// ── Colores del panal (nunca más de 4) ───────────────────────────────────
const COLORES = ['#F5C84C', '#9B7FE8', '#5FD9C4', '#FF6F91']
const NOMBRES_COLOR = ['dorado', 'violeta', 'turquesa', 'rosa']

const PARAMETROS_DIFICULTAD = {
  1: { incluirCentro: true, colores: 2, kMin: 3, kMax: 4 },
  2: { incluirCentro: false, colores: 3, kMin: 5, kMax: 6 },
  3: { incluirCentro: false, colores: 4, kMin: 8, kMax: 9 },
}

const SEGUNDOS_PISTA_AUTOMATICA = 45

function mod(n, m) { return ((n % m) + m) % m }

function crearAleatorio(semilla) {
  let estado = semilla >>> 0
  return function () {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Geometría hexagonal axial (igual para 7 y 18 hexágonos) ─────────────
const DIRECCIONES = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]

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

function construirTablero(incluirCentro) {
  const crudos = incluirCentro ? [{ q: 0, r: 0 }, ...anilloHex(1)] : [...anilloHex(1), ...anilloHex(2)]
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
  return { hexes, vecinos }
}

// Convierte coordenadas axiales a posición porcentual — el panal se dibuja
// con botones posicionados en % dentro de un contenedor con aspect-ratio,
// sin canvas ni JS de resize.
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
  return { posiciones, aspecto: rangoX / rangoY, anchoHexPct }
}

// ── Secuencia de rondas: empieza trivial y crece sola ────────────────────
// Nunca se generan estados al azar (podrían ser irresolubles): siempre se
// parte del estado uniforme (ya "resuelto") y se aplican K pulsos hacia
// atrás — eso garantiza que existe un camino de vuelta.
function generarSecuenciaRondas(dificultad) {
  const d = PARAMETROS_DIFICULTAD[dificultad]
  return [
    { incluirCentro: true, colores: 2, k: 1 },
    { incluirCentro: true, colores: 2, k: 2 },
    { incluirCentro: d.incluirCentro, colores: d.colores, k: d.kMin },
    { incluirCentro: d.incluirCentro, colores: d.colores, k: d.kMax },
  ]
}

function generarRonda(azar, config) {
  const tablero = construirTablero(config.incluirCentro)
  const fases = new Map(tablero.hexes.map((h) => [h.id, 0]))
  const contadorClicks = new Map(tablero.hexes.map((h) => [h.id, 0]))

  function pulsar(id) {
    fases.set(id, mod(fases.get(id) + 1, config.colores))
    for (const vecino of tablero.vecinos.get(id)) {
      fases.set(vecino, mod(fases.get(vecino) + 1, config.colores))
    }
  }

  // En el panal de 7 (centro + anillo) el centro es vecino de TODOS los
  // demás — si el sorteo lo eligiera, un solo click podría "resolver" el
  // panal por accidente (todos cambian igual). Se excluye como objetivo de
  // mezclado para que K pulsos sea siempre K pulsos de verdad.
  const idsParaMezclar = tablero.hexes.map((h) => h.id).filter((id) => id !== '0,0' || !config.incluirCentro)
  for (let i = 0; i < config.k; i++) {
    const id = idsParaMezclar[Math.floor(azar() * idsParaMezclar.length)]
    pulsar(id)
    contadorClicks.set(id, contadorClicks.get(id) + 1)
  }

  return { tablero, fases, contadorClicks, colores: config.colores, optimo: config.k, pulsar }
}

function calcularCorreccion(ronda) {
  const correccion = new Map()
  for (const h of ronda.tablero.hexes) {
    correccion.set(h.id, mod(ronda.colores - mod(ronda.contadorClicks.get(h.id), ronda.colores), ronda.colores))
  }
  return correccion
}

function estaResuelta(ronda) {
  const valores = [...ronda.fases.values()]
  return valores.every((v) => v === valores[0])
}

function calcularConvergencia(ronda) {
  let sumaCos = 0, sumaSin = 0
  for (const v of ronda.fases.values()) {
    const angulo = (2 * Math.PI * v) / ronda.colores
    sumaCos += Math.cos(angulo)
    sumaSin += Math.sin(angulo)
  }
  const n = ronda.fases.size
  return Math.sqrt(sumaCos * sumaCos + sumaSin * sumaSin) / n
}

// ── Galaxia procedural (SVG, sin imágenes externas) ──────────────────────
// Se dibuja UNA vez por partida (misma semilla → misma galaxia) y después
// no vuelve a redibujarse: lo único que cambia es el blur según la
// convergencia, así que no hace falta rehacer el SVG en cada click.
function generarGalaxiaSVG(azar) {
  const estrellas = []
  for (let i = 0; i < 70; i++) {
    const angulo = azar() * Math.PI * 2
    const radio = Math.pow(azar(), 0.5) * 140
    estrellas.push({
      x: 150 + Math.cos(angulo) * radio,
      y: 150 + Math.sin(angulo) * radio,
      r: azar() * 1.3 + .3,
      o: azar() * .6 + .25,
    })
  }
  let brazos = ''
  for (let brazo = 0; brazo < 2; brazo++) {
    const offset = brazo * Math.PI
    let puntos = ''
    for (let t = 0; t < 60; t++) {
      const progreso = t / 60
      const angulo = offset + progreso * Math.PI * 2.4
      const radio = 18 + progreso * 125
      const x = 150 + Math.cos(angulo) * radio
      const y = 150 + Math.sin(angulo) * radio
      const r = 2.6 * (1 - progreso) + .4
      brazos += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#cdbcff" opacity="${(0.5 * (1 - progreso) + .08).toFixed(2)}"/>`
    }
  }
  const estrellasSVG = estrellas.map((s) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.r.toFixed(2)}" fill="#fff" opacity="${s.o.toFixed(2)}"/>`).join('')
  return `
    <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mwe-nucleo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff7e0"/>
          <stop offset="35%" stop-color="#e8c9ff"/>
          <stop offset="100%" stop-color="#e8c9ff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="300" height="300" fill="#0a0714"/>
      ${estrellasSVG}
      ${brazos}
      <circle cx="150" cy="150" r="46" fill="url(#mwe-nucleo)"/>
      <circle cx="150" cy="150" r="10" fill="#fff7e0"/>
    </svg>`
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
  let quitarTeclado = null

  const secuenciaRondas = generarSecuenciaRondas(opciones.dificultad)
  let indiceRonda = 0
  let ronda = null
  let historial = [] // pila de ids clickeados, para DESHACER
  let toquesJugador = 0
  let optimoTotal = secuenciaRondas.reduce((a, c) => a + c.k, 0)
  let tiempoInactividad = 0
  let manitaEl = null

  // -- construcción del DOM --
  const estilo = document.createElement('style')
  estilo.textContent = CSS_JUEGO
  contenedor.appendChild(estilo)

  const raiz = document.createElement('div')
  raiz.className = 'mwe-raiz'
  raiz.innerHTML = `
    <div class="mwe-zona-panal">
      <div class="mwe-panal-envoltorio">
        <div class="mwe-panal" role="group" aria-label="Panal de espejos"></div>
      </div>
      <div class="mwe-controles">
        <button type="button" class="mwe-boton-deshacer" data-accion="deshacer" disabled>↩ Deshacer</button>
      </div>
      <p class="mwe-anuncio" aria-live="polite"></p>
    </div>
    <div class="mwe-zona-galaxia">
      <div class="mwe-galaxia">${generarGalaxiaSVG(crearAleatorio((opciones.semilla >>> 0 || 1) + 777))}</div>
    </div>
  `
  contenedor.appendChild(raiz)

  const panalEl = raiz.querySelector('.mwe-panal')
  const galaxiaEl = raiz.querySelector('.mwe-galaxia')
  const botonDeshacer = raiz.querySelector('[data-accion="deshacer"]')
  const anuncioEl = raiz.querySelector('.mwe-anuncio')

  const elementosHex = new Map()

  function anunciar(texto) {
    if (opciones.modoAccesible) anuncioEl.textContent = texto
  }

  function construirPanalDOM() {
    elementosHex.clear()
    const layout = calcularLayoutHex(ronda.tablero.hexes)
    const anchoMinimo = Math.ceil(4800 / layout.anchoHexPct)
    panalEl.style.aspectRatio = String(layout.aspecto)
    panalEl.style.minWidth = `${anchoMinimo}px`
    panalEl.innerHTML = ronda.tablero.hexes.map((h) => {
      const pos = layout.posiciones.get(h.id)
      return `<button type="button" class="mwe-hex" data-id="${h.id}" tabindex="-1"
        style="left:${pos.leftPct}%;top:${pos.topPct}%;width:${pos.anchoHexPct}%;height:${pos.altoHexPct}%"></button>`
    }).join('')
    panalEl.querySelectorAll('.mwe-hex').forEach((el) => elementosHex.set(el.dataset.id, el))
    const primerHex = elementosHex.get(ronda.tablero.hexes[0].id)
    if (primerHex) primerHex.tabIndex = 0
  }

  function pintarHexes() {
    for (const h of ronda.tablero.hexes) {
      const el = elementosHex.get(h.id)
      if (!el) continue
      const color = ronda.fases.get(h.id)
      el.style.background = COLORES[color]
      el.setAttribute('aria-label', `Espejo color ${NOMBRES_COLOR[color]}`)
    }
  }

  function quitarManita() {
    manitaEl?.remove()
    manitaEl = null
  }

  function mostrarManita(idHex, { persistente = false } = {}) {
    quitarManita()
    const el = elementosHex.get(idHex)
    if (!el) return
    manitaEl = document.createElement('div')
    manitaEl.className = 'mwe-manita'
    manitaEl.innerHTML = `
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="24" r="14" fill="currentColor" opacity=".25"/>
        <circle cx="30" cy="24" r="7" fill="currentColor"/>
      </svg>`
    manitaEl.style.left = el.style.left
    manitaEl.style.top = el.style.top
    panalEl.appendChild(manitaEl)
    if (!persistente) setTimeout(quitarManita, 2600)
  }

  function resaltarPistaHex() {
    if (destruido || estaResuelta(ronda)) return
    const correccion = calcularCorreccion(ronda)
    const candidato = ronda.tablero.hexes.find((h) => correccion.get(h.id) > 0)
    if (!candidato) return
    mostrarManita(candidato.id)
  }

  function actualizarGalaxia() {
    const convergencia = calcularConvergencia(ronda)
    const desenfoque = (1 - convergencia) * 18
    galaxiaEl.style.filter = `blur(${desenfoque}px)`
  }

  function actualizarBotonDeshacer() {
    botonDeshacer.disabled = historial.length === 0
  }

  function manejarClicHex(id) {
    if (destruido || pausado || estaResuelta(ronda)) return
    quitarManita()
    ronda.pulsar(id)
    ronda.contadorClicks.set(id, ronda.contadorClicks.get(id) + 1)
    historial.push(id)
    toquesJugador += 1
    tiempoInactividad = 0
    ayuda?.marcarLogro()
    animarOnda(id)
    pintarHexes()
    actualizarGalaxia()
    actualizarBotonDeshacer()
    anunciar(`Espejo ${NOMBRES_COLOR[ronda.fases.get(id)]}`)
    tono({ frecuencia: 300 + ronda.fases.get(id) * 60, duracion: .09, tipo: 'sine', ganancia: .12 })
    emitir('progreso', (indiceRonda + calcularConvergencia(ronda)) / secuenciaRondas.length)
    if (estaResuelta(ronda)) {
      setTimeout(finalizarRonda, 500)
    }
  }

  function deshacer() {
    if (historial.length === 0 || estaResuelta(ronda)) return
    const id = historial.pop()
    for (let i = 0; i < ronda.colores - 1; i++) ronda.pulsar(id)
    ronda.contadorClicks.set(id, ronda.contadorClicks.get(id) - 1)
    toquesJugador = Math.max(0, toquesJugador - 1)
    tiempoInactividad = 0
    pintarHexes()
    actualizarGalaxia()
    actualizarBotonDeshacer()
  }

  function animarOnda(idOrigen) {
    const origen = elementosHex.get(idOrigen)
    origen?.classList.add('mwe-hex--onda')
    setTimeout(() => origen?.classList.remove('mwe-hex--onda'), 240)
    const vecinos = ronda.tablero.vecinos.get(idOrigen) || []
    vecinos.forEach((vId) => {
      const el = elementosHex.get(vId)
      if (!el) return
      setTimeout(() => {
        el.classList.add('mwe-hex--onda-vecino')
        setTimeout(() => el.classList.remove('mwe-hex--onda-vecino'), 240)
      }, 40)
    })
  }

  function iniciarRonda() {
    quitarManita()
    ronda = generarRonda(azar, secuenciaRondas[indiceRonda])
    historial = []
    construirPanalDOM()
    pintarHexes()
    actualizarGalaxia()
    actualizarBotonDeshacer()
    tiempoInactividad = 0
    if (indiceRonda === 0) {
      // La primera ronda siempre se resuelve en un solo toque: la manita
      // señala el espejo correcto desde el principio, sin esperar a que se
      // trabe — es la forma en que se enseña la regla completa sin decirla.
      const correccion = calcularCorreccion(ronda)
      const objetivo = ronda.tablero.hexes.find((h) => correccion.get(h.id) > 0)
      if (objetivo) mostrarManita(objetivo.id, { persistente: true })
    }
  }

  function finalizarRonda() {
    quitarManita()
    barrido({ desde: 500 + indiceRonda * 120, hasta: 900 + indiceRonda * 120, duracion: .5, tipo: 'sine', ganancia: .14 })
    if (indiceRonda >= secuenciaRondas.length - 1) {
      finalizarPartida()
    } else {
      indiceRonda += 1
      setTimeout(iniciarRonda, 700)
    }
  }

  function finalizarPartida() {
    const { estrellas } = evaluarEstrellas({
      metricas: { toques: toquesJugador, optimo: optimoTotal },
      umbrales: [
        { estrellas: 1, descripcion: 'Resolverlo', condicion: () => true },
        { estrellas: 2, descripcion: 'En pocos toques', condicion: (m) => m.toques <= m.optimo + 8 },
        { estrellas: 3, descripcion: 'Casi los mínimos', condicion: (m) => m.toques <= m.optimo + 3 },
      ],
    })
    emitir('superada', { estrellas, toques: toquesJugador, optimo: optimoTotal })
  }

  function cuadro(dt) {
    if (pausado || destruido) return
    // Corre en todas las rondas, incluida la primera: la manita inicial
    // marca el camino más obvio, pero si el jugador toca otro espejo y se
    // desorienta, no debe quedarse sin ayuda hasta la ronda siguiente.
    if (!estaResuelta(ronda)) {
      tiempoInactividad += dt
      if (tiempoInactividad >= SEGUNDOS_PISTA_AUTOMATICA) {
        tiempoInactividad = 0
        resaltarPistaHex()
      }
    }
  }

  panalEl.addEventListener('click', (e) => {
    const boton = e.target.closest('.mwe-hex')
    if (boton) manejarClicHex(boton.dataset.id)
  })
  botonDeshacer.addEventListener('click', deshacer)

  const DIRECCION_FLECHA = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    ArrowUp: [0, -1], ArrowDown: [0, 1],
  }
  entrada = crearEntrada(raiz)
  quitarTeclado = entrada.on('tecla-abajo', ({ tecla, original }) => {
    const activo = document.activeElement
    if (tecla === ' ' || tecla === 'Enter') {
      if (activo?.classList?.contains('mwe-hex')) {
        original?.preventDefault?.()
        manejarClicHex(activo.dataset.id)
      }
      return
    }
    const dir = DIRECCION_FLECHA[tecla]
    if (!dir || !activo?.classList?.contains('mwe-hex')) return
    original?.preventDefault?.()
    // Se navega por dirección de PANTALLA (no por eje hexagonal fijo): entre
    // los vecinos reales del hexágono enfocado, se elige el que mejor
    // coincide con la flecha presionada. Así "arriba" siempre se siente
    // como arriba, sin importar la orientación del panal.
    const idsVecinos = ronda.tablero.vecinos.get(activo.dataset.id) || []
    if (idsVecinos.length === 0) return
    const layout = calcularLayoutHex(ronda.tablero.hexes)
    const posActual = layout.posiciones.get(activo.dataset.id)
    let mejor = null, mejorPuntaje = -Infinity
    for (const id of idsVecinos) {
      const pos = layout.posiciones.get(id)
      const dx = pos.leftPct - posActual.leftPct
      const dy = pos.topPct - posActual.topPct
      const largo = Math.hypot(dx, dy) || 1
      const puntaje = (dx / largo) * dir[0] + (dy / largo) * dir[1]
      if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = id }
    }
    const destino = mejor && elementosHex.get(mejor)
    if (destino) {
      activo.tabIndex = -1
      destino.tabIndex = 0
      destino.focus()
      anunciar(`Espejo ${NOMBRES_COLOR[ronda.fases.get(mejor)]}`)
    }
  })

  const ayuda = crearAyuda(raiz, {
    id: 'webb',
    pasos: [
      { texto: 'Toca un espejo para cambiarle el color.', dibujo: 'tocar' },
      { texto: 'Ojo: sus vecinos también cambian.', dibujo: 'mwe-vecinos' },
      { texto: 'Mira la galaxia de al lado. Mientras más pareja va quedando, más se enfoca.', dibujo: 'meta' },
      { texto: 'Deja todos los espejos del mismo color y la vas a ver clarita.', dibujo: 'mwe-galaxia-clara' },
    ],
    alAbrir: () => { pausado = true },
    alCerrar: () => { pausado = false },
    demostrar: () => demostrar(),
    siguientePista: () => resaltarPistaHex(),
  })

  function demostrar() {
    // El juego se resuelve solo de verdad (cada toque cambia el color de
    // verdad, con su onda y su sonido) y al final se restaura el estado
    // previo del jugador — "el jugador solo mira" no debe significar que
    // avanza gratis, solo que ve la mecánica completa en acción.
    pausado = true
    const fasesGuardadas = new Map(ronda.fases)
    const contadorGuardado = new Map(ronda.contadorClicks)
    const historialGuardado = [...historial]

    const pasos = []
    for (const [id, veces] of calcularCorreccion(ronda)) {
      for (let i = 0; i < veces; i++) pasos.push(id)
    }

    let i = 0
    function siguientePaso() {
      if (destruido) return
      if (i >= pasos.length) {
        setTimeout(() => {
          if (destruido) return
          // Mutar los mismos Map en vez de reasignarlos: ronda.pulsar()
          // los tiene capturados por clausura y debe seguir mutando los
          // mismos objetos.
          ronda.fases.clear()
          for (const [k, v] of fasesGuardadas) ronda.fases.set(k, v)
          ronda.contadorClicks.clear()
          for (const [k, v] of contadorGuardado) ronda.contadorClicks.set(k, v)
          historial = historialGuardado
          pintarHexes()
          actualizarGalaxia()
          actualizarBotonDeshacer()
          pausado = false
        }, 1100)
        return
      }
      const id = pasos[i]
      mostrarManita(id, { persistente: true })
      setTimeout(() => {
        if (destruido) return
        ronda.pulsar(id)
        ronda.contadorClicks.set(id, ronda.contadorClicks.get(id) + 1)
        animarOnda(id)
        pintarHexes()
        actualizarGalaxia()
        tono({ frecuencia: 300 + ronda.fases.get(id) * 60, duracion: .09, tipo: 'sine', ganancia: .1 })
        quitarManita()
        i += 1
        setTimeout(siguientePaso, 350)
      }, 700)
    }
    siguientePaso()
  }

  // ── contrato ──────────────────────────────────────────────────────────
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
  .mwe-raiz { grid-template-columns: 3fr 2fr; align-items: center; }
}
.mwe-zona-panal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--e-4, 1rem);
  min-width: 0;
}
.mwe-panal-envoltorio {
  width: 100%;
  max-width: 460px;
  overflow-x: auto;
  padding: var(--e-2, .5rem);
}
.mwe-panal {
  position: relative;
  width: 100%;
  margin: 0 auto;
}
.mwe-hex {
  position: absolute;
  transform: translate(-50%, -50%);
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
  border: none;
  min-width: 48px;
  min-height: 42px;
  cursor: pointer;
  transition: background .2s ease;
  box-shadow: inset 0 0 0 2px rgba(212, 175, 106, .5);
}
.mwe-hex:focus-visible { outline: 3px solid #fff; outline-offset: 3px; z-index: 2; }
.mwe-hex--onda, .mwe-hex--onda-vecino { box-shadow: inset 0 0 0 2px rgba(212, 175, 106, .5), 0 0 0 4px rgba(155, 127, 232, .8); }
.mwe-hex--onda { animation: mwe-onda .24s cubic-bezier(.2,.8,.2,1); }
.mwe-hex--onda-vecino { animation: mwe-onda-vecino .24s cubic-bezier(.2,.8,.2,1); }
@keyframes mwe-onda {
  0% { transform: translate(-50%, -50%) scale(1); }
  40% { transform: translate(-50%, -50%) scale(1.16); }
  100% { transform: translate(-50%, -50%) scale(1); }
}
@keyframes mwe-onda-vecino { 0%, 100% { opacity: 1; } 50% { opacity: .75; } }

.mwe-manita {
  position: absolute;
  transform: translate(-50%, -110%);
  width: 60px;
  height: 60px;
  color: #fff;
  pointer-events: none;
  animation: mwe-manita-tap 1s ease-in-out infinite;
  z-index: 3;
}
@keyframes mwe-manita-tap {
  0%, 100% { transform: translate(-50%, -110%); }
  50% { transform: translate(-50%, -85%); }
}

.mwe-controles { display: flex; justify-content: center; }
.mwe-boton-deshacer {
  min-height: 44px;
  padding: 0 var(--e-6, 1.5rem);
  border-radius: var(--e-2, .5rem);
  border: 1px solid var(--acento-mision, #9B7FE8);
  background: color-mix(in srgb, var(--acento-mision, #9B7FE8) 14%, transparent);
  color: #fff;
  font-size: var(--hud-label);
  font-weight: 600;
  cursor: pointer;
}
.mwe-boton-deshacer:disabled { opacity: .35; cursor: default; }
.mwe-anuncio { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

.mwe-zona-galaxia {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--e-4, 1rem);
}
.mwe-galaxia {
  width: min(100%, 320px);
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  filter: blur(18px);
  transition: filter .5s ease;
  box-shadow: 0 0 40px rgba(155, 127, 232, .2);
}
.mwe-galaxia svg { display: block; width: 100%; height: 100%; }

@media (prefers-reduced-motion: reduce) {
  .mwe-hex, .mwe-hex--onda, .mwe-hex--onda-vecino, .mwe-manita {
    animation: none !important;
    transition: none !important;
  }
  /* La nitidez de la galaxia sigue funcionando como pista: es un valor de
     estado (blur calculado por convergencia), no una animación en loop —
     por eso no hace falta tocar .mwe-galaxia acá. */
}
`
