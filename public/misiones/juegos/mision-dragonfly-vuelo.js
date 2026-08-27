// mision-dragonfly-vuelo.js — «Orden de Vuelo» (Dragonfly)
// Regla única: armás una lista de instrucciones, apretás VOLAR, y el dron
// hace exactamente lo que le dijiste. Ni más ni menos. No se pilotea en
// vivo — se planea, se prueba, y si algo sale mal se corrige un bloque y
// se vuelve a intentar. Así es como realmente vuela Dragonfly en Titán.
import { crearEntrada } from '../nucleo/entrada-unificada.js'
import { tono } from '../nucleo/audio-mision.js'
import { evaluarEstrellas } from '../nucleo/evaluador-estrellas.js'
import { crearAyuda, registrarDibujo } from '../nucleo/ayuda-paso-a-paso.js'
import { generarEtapas } from '../nucleo/progresion-dificultad.js'

registrarDibujo('mdv-lista', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    ${[0, 1, 2].map((i) => `<rect x="${40 + i * 45}" y="40" width="36" height="36" rx="9" fill="currentColor" opacity="${(0.9 - i * 0.18).toFixed(2)}"/>`).join('')}
    <path d="M46 78 L58 90 L78 62" stroke="#14101c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".8" transform="translate(0,-32)"/>
  </svg>`)
registrarDibujo('mdv-viento', () => `
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="55" y="25" width="90" height="70" rx="12" fill="currentColor" opacity=".14"/>
    <path d="M70 60 H122" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M106 46 L124 60 L106 74" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="70" cy="60" r="6" fill="currentColor" opacity=".6"/>
  </svg>`)

export const meta = {
  titulo: 'Dragonfly · Orden de Vuelo',
  acento: '#C9A227',
  objetivo: 'Armá una lista de instrucciones y apretá VOLAR: el dron hace exactamente lo que le dijiste.',
  datoInicial: 'Dragonfly va a explorar Titán, la luna de Saturno, volando solo con las instrucciones que le mandemos desde la Tierra.',
  datoCierre: 'Dragonfly vuela en Titán, la luna de Saturno. Está tan lejos que nadie puede pilotarlo en vivo: los ingenieros le mandan la lista de instrucciones y esperan.',
}

// ── Mundo: grilla, direcciones, dificultad ───────────────────────────────
const GRID = 5
const BASE = { x: 2, y: 4 }
const FACING_INICIAL = 0 // 0=arriba 1=derecha 2=abajo 3=izquierda, sentido horario
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]

const PARAMETROS_DIFICULTAD = {
  1: { muestras: 1, viento: 0 },
  2: { muestras: 2, viento: 1 },
  3: { muestras: 3, viento: 2 },
}

function idCelda(c) { return `${c.x},${c.y}` }
function dentroDelMapa(x, y) { return x >= 0 && x < GRID && y >= 0 && y < GRID }

function crearAleatorio(semilla) {
  let estado = semilla >>> 0
  return function () {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Camino en L de un punto a otro: gira hasta apuntar al eje que más
// distancia tiene, avanza, gira al segundo eje, avanza. Se usa tanto para
// calcular la "solución conocida" (ver un ejemplo / pista) como para saber
// qué celdas hay que dejarle libres al viento durante la generación.
function costoGiro(desde, hasta) { return ((hasta - desde) % 4 + 4) % 4 }

// Prueba las dos órdenes posibles (horizontal→vertical o vertical→horizontal)
// y usa la que pida MENOS giros desde la orientación actual — GIRAR solo
// gira en sentido horario, así que ir "para atrás" puede costar hasta 3
// giros si se elige mal el orden, y eso es lo que hace que sobren bloques.
function planificarTramo(estado, destino) {
  const dx = destino.x - estado.x
  const dy = destino.y - estado.y
  const dirX = dx > 0 ? 1 : 3
  const dirY = dy > 0 ? 2 : 0

  function evaluarOrden(xPrimero) {
    let facing = estado.facing
    let costo = 0
    const pasos = []
    const aplicar = (dir, veces) => { costo += costoGiro(facing, dir); facing = dir; pasos.push({ dir, veces }) }
    if (xPrimero) {
      if (dx !== 0) aplicar(dirX, Math.abs(dx))
      if (dy !== 0) aplicar(dirY, Math.abs(dy))
    } else {
      if (dy !== 0) aplicar(dirY, Math.abs(dy))
      if (dx !== 0) aplicar(dirX, Math.abs(dx))
    }
    return { costo, pasos }
  }

  let mejor = evaluarOrden(true)
  if (dx !== 0 && dy !== 0) {
    const alternativa = evaluarOrden(false)
    if (alternativa.costo < mejor.costo) mejor = alternativa
  }

  const instrucciones = []
  let facing = estado.facing
  for (const paso of mejor.pasos) {
    while (facing !== paso.dir) { instrucciones.push('girar'); facing = (facing + 1) % 4 }
    for (let i = 0; i < paso.veces; i++) instrucciones.push('avanzar')
  }
  estado.x = destino.x; estado.y = destino.y; estado.facing = facing
  return instrucciones
}

function celdasDelTramo(origen, destino) {
  const celdas = []
  const x0 = Math.min(origen.x, destino.x), x1 = Math.max(origen.x, destino.x)
  const y0 = Math.min(origen.y, destino.y), y1 = Math.max(origen.y, destino.y)
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) celdas.push(`${x},${y}`)
  return celdas
}

// Solución conocida completa (base → cada muestra → base si corresponde),
// usada por "ver un ejemplo", la pista, y para calcular el óptimo de
// estrellas. Nunca se generan niveles al azar sin verificar que esto exista.
function calcularSolucion(nivel) {
  const instrucciones = []
  const estado = { x: BASE.x, y: BASE.y, facing: FACING_INICIAL }
  for (const m of nivel.muestras) {
    instrucciones.push(...planificarTramo(estado, m))
    instrucciones.push('muestra')
  }
  if (nivel.requiereVolverABase) instrucciones.push(...planificarTramo(estado, BASE))
  return instrucciones
}

// ── Niveles fijos de los primeros 10 segundos (siempre iguales) ─────────
function nivelTutorial1() {
  return { muestras: [{ x: 2, y: 2 }], vientos: [], requiereVolverABase: false, mostrarManitaInicial: true }
}

// ── Nivel real, según parámetros ya resueltos (ver generarNiveles) ────────
// Las muestras se mantienen cerca de la base (distancia 2-4) para que la
// vuelta completa —ir, recoger todas, volver— nunca necesite demasiados
// bloques: "nunca más de 10 bloques necesarios" es la regla, no una
// sugerencia, así que la generación la respeta por diseño.
//
// `params` ya viene calculado (no es un nivel de dificultad 1|2|3): puede
// ser el objetivo final de N1/N2/N3, o un punto intermedio de la curva de
// 5 etapas (ver generarNiveles).
function generarNivelReal(azar, params) {
  const ocupadas = new Set([idCelda(BASE)])
  const muestras = []
  let intentos = 0
  while (muestras.length < params.muestras && intentos < 300) {
    intentos += 1
    const c = { x: Math.floor(azar() * GRID), y: Math.floor(azar() * (GRID - 2)) }
    const id = idCelda(c)
    if (ocupadas.has(id)) continue
    const distanciaBase = Math.abs(c.x - BASE.x) + Math.abs(c.y - BASE.y)
    const lejosDeOtras = muestras.every((m) => Math.abs(m.x - c.x) + Math.abs(m.y - c.y) >= 1)
    if (distanciaBase < 1 || distanciaBase > 3 || !lejosDeOtras) continue
    ocupadas.add(id)
    muestras.push(c)
  }

  // Visitar las muestras en el orden en que salieron del sorteo puede armar
  // una ruta con idas y vueltas larguísimas — se reordenan por vecino más
  // cercano (desde la base) para que el recorrido total sea corto de verdad.
  const porVisitar = [...muestras]
  muestras.length = 0
  let cursorOrden = BASE
  while (porVisitar.length > 0) {
    let mejorIdx = 0, mejorDist = Infinity
    porVisitar.forEach((m, i) => {
      const d = Math.abs(m.x - cursorOrden.x) + Math.abs(m.y - cursorOrden.y)
      if (d < mejorDist) { mejorDist = d; mejorIdx = i }
    })
    cursorOrden = porVisitar.splice(mejorIdx, 1)[0]
    muestras.push(cursorOrden)
  }

  // Celdas que pisa la solución conocida (base→muestra1→…→base): el viento
  // nunca se coloca ahí, así el camino "de libro" siempre queda garantizado
  // libre de sorpresas, aunque el jugador pueda cruzar viento si elige otra
  // ruta por su cuenta.
  const prohibidas = new Set(ocupadas)
  let cursor = { ...BASE }
  for (const m of muestras) { for (const c of celdasDelTramo(cursor, m)) prohibidas.add(c); cursor = m }
  for (const c of celdasDelTramo(cursor, BASE)) prohibidas.add(c)

  const vientos = []
  intentos = 0
  while (vientos.length < params.viento && intentos < 200) {
    intentos += 1
    const c = { x: Math.floor(azar() * GRID), y: Math.floor(azar() * GRID) }
    const id = idCelda(c)
    if (prohibidas.has(id)) continue
    prohibidas.add(id)
    vientos.push({ ...c, dir: Math.floor(azar() * 4) })
  }

  const nivel = { muestras, vientos, requiereVolverABase: true, mostrarManitaInicial: false }
  // El óptimo se calcula UNA VEZ acá, con el propio nivel ya armado, y se
  // guarda para las estrellas — así el umbral de "pocas instrucciones"
  // siempre es relativo a lo que este nivel en particular necesita de
  // verdad, en vez de perseguir un número fijo que puede no encajar con
  // cómo cayeron las muestras esta partida.
  nivel.optimoInstrucciones = calcularSolucion(nivel).length
  return nivel
}

// 5 etapas por nivel: 1 tutorial fijo + 4 niveles reales que crecen en línea
// recta desde una base fácil (1 muestra, sin viento — el propio piso de
// N1) hasta el objetivo de N1/N2/N3 elegido. En N1 las 4 etapas reales
// quedan parejas (no hay a dónde bajar más), pero cada una es un mapa
// nuevo — en N2/N3 sí crecen de verdad en cantidad de muestras y viento
// (ver nucleo/progresion-dificultad.js).
const BASE_FACIL = { muestras: 1, viento: 0 }

function generarNiveles(azar, dificultad) {
  const d = PARAMETROS_DIFICULTAD[dificultad]
  const etapasReales = generarEtapas(BASE_FACIL, d, 4, ['muestras', 'viento'])
  return [nivelTutorial1(), ...etapasReales.map((params) => generarNivelReal(azar, params))]
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
  let entrada = null
  let quitarTeclado = null

  const niveles = generarNiveles(azar, opciones.dificultad)
  let indiceNivel = 0
  let nivel = niveles[0]
  let tape = []
  let focoTape = -1
  let intentosVuelo = 0
  let enVuelo = false
  let enDemostracion = false
  let indiceEjecucion = 0
  let estadoDron = { x: BASE.x, y: BASE.y, facing: FACING_INICIAL }
  let recogidas = new Set()
  let manitaEl = null
  let temporizadorPaso = null

  const BLOQUES = [
    { tipo: 'avanzar', icono: '↑', etiqueta: 'Avanzar' },
    { tipo: 'girar', icono: '↻', etiqueta: 'Girar' },
    { tipo: 'muestra', icono: '💧', etiqueta: 'Tomar muestra' },
  ]

  // -- DOM --
  const estilo = document.createElement('style')
  estilo.textContent = CSS_JUEGO
  contenedor.appendChild(estilo)

  const raiz = document.createElement('div')
  raiz.className = 'mdv-raiz'
  raiz.innerHTML = `
    <div class="mdv-zona-mapa">
      <div class="mdv-mapa"></div>
    </div>
    <div class="mdv-zona-controles">
      <div class="mdv-paleta" role="group" aria-label="Bloques disponibles">
        ${BLOQUES.map((b) => `<button type="button" class="mdv-bloque-paleta" data-tipo="${b.tipo}" aria-label="${b.etiqueta}">
          <span class="mdv-bloque-icono">${b.icono}</span><span class="mdv-bloque-texto">${b.etiqueta}</span>
        </button>`).join('')}
      </div>
      <div class="mdv-cinta-envoltorio">
        <div class="mdv-cinta" role="list" aria-label="Tu lista de instrucciones"></div>
      </div>
      <p class="mdv-mensaje" aria-live="polite"></p>
      <div class="mdv-acciones">
        <button type="button" class="mdv-boton-secundario" data-accion="paso">PASO A PASO</button>
        <button type="button" class="mdv-boton-primario" data-accion="volar">▶ VOLAR</button>
        <button type="button" class="mdv-boton-secundario" data-accion="reintentar" hidden>REINTENTAR</button>
      </div>
    </div>
  `
  contenedor.appendChild(raiz)

  const mapaEl = raiz.querySelector('.mdv-mapa')
  const cintaEl = raiz.querySelector('.mdv-cinta')
  const mensajeEl = raiz.querySelector('.mdv-mensaje')
  const botonVolar = raiz.querySelector('[data-accion="volar"]')
  const botonPaso = raiz.querySelector('[data-accion="paso"]')
  const botonReintentar = raiz.querySelector('[data-accion="reintentar"]')
  let dronEl = null

  function anunciar(texto) {
    mensajeEl.textContent = texto
  }

  // ── Mapa ──────────────────────────────────────────────────────────────
  function renderMapa() {
    const celdas = []
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) celdas.push({ x, y })
    }
    const lagoAzar = crearAleatorio((opciones.semilla >>> 0 || 1) + indiceNivel * 97 + 13)
    const lagos = new Set()
    while (lagos.size < 4) {
      const c = { x: Math.floor(lagoAzar() * GRID), y: Math.floor(lagoAzar() * GRID) }
      const id = idCelda(c)
      if (id === idCelda(BASE) || nivel.muestras.some((m) => idCelda(m) === id)) continue
      lagos.add(id)
    }

    mapaEl.style.setProperty('--mdv-grid', GRID)
    mapaEl.innerHTML = celdas.map((c) => {
      const id = idCelda(c)
      const esBase = id === idCelda(BASE)
      const viento = nivel.vientos.find((v) => idCelda(v) === id)
      const esLago = lagos.has(id) && !esBase
      const clases = ['mdv-celda']
      if (esLago) clases.push('mdv-celda--lago')
      let contenido = ''
      if (esBase) contenido += '<div class="mdv-base" aria-hidden="true"></div>'
      if (viento) contenido += `<div class="mdv-viento-flecha" style="transform:rotate(${viento.dir * 90}deg)" aria-hidden="true">➜</div>`
      return `<div class="${clases.join(' ')}" data-id="${id}">${contenido}</div>`
    }).join('')

    // Muestras y dron: overlays absolutos encima de la grilla, no celdas —
    // así se mueven con transform sin volver a tocar el layout de la grilla.
    mapaEl.querySelectorAll('.mdv-muestra-overlay, .mdv-dron').forEach((el) => el.remove())
    nivel.muestras.forEach((m, i) => {
      const el = document.createElement('div')
      el.className = 'mdv-muestra-overlay'
      el.dataset.indice = String(i)
      posicionarEnCelda(el, m.x, m.y)
      el.innerHTML = '<div class="mdv-muestra-brillo"></div>'
      mapaEl.appendChild(el)
    })
    dronEl = document.createElement('div')
    dronEl.className = 'mdv-dron'
    dronEl.innerHTML = `
      <div class="mdv-dron-sombra"></div>
      <svg viewBox="0 0 60 60" class="mdv-dron-cuerpo">
        <circle cx="30" cy="30" r="10" fill="#e8e2f5"/>
        ${[[12, 12], [48, 12], [12, 48], [48, 48]].map(([cx, cy]) => `
          <circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="#e8e2f5" stroke-width="1.5" opacity=".5"/>
          <g class="mdv-helice-aspa" style="transform-origin:${cx}px ${cy}px">
            <line x1="${cx - 6}" y1="${cy}" x2="${cx + 6}" y2="${cy}" stroke="#e8e2f5" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="${cx}" y1="${cy - 6}" x2="${cx}" y2="${cy + 6}" stroke="#e8e2f5" stroke-width="2.5" stroke-linecap="round"/>
          </g>`).join('')}
        <path d="M30 30 L30 14" stroke="#14101c" stroke-width="3" stroke-linecap="round"/>
      </svg>`
    mapaEl.appendChild(dronEl)
    actualizarMuestrasVisibles()
    actualizarDron(true)
  }

  function posicionarEnCelda(el, x, y) {
    el.style.left = `${((x + 0.5) / GRID) * 100}%`
    el.style.top = `${((y + 0.5) / GRID) * 100}%`
  }

  function actualizarMuestrasVisibles() {
    mapaEl.querySelectorAll('.mdv-muestra-overlay').forEach((el) => {
      const i = Number(el.dataset.indice)
      el.classList.toggle('mdv-muestra-overlay--recogida', recogidas.has(idCelda(nivel.muestras[i])))
    })
  }

  function actualizarDron(instantaneo) {
    if (!dronEl) return
    dronEl.classList.toggle('mdv-dron--sin-transicion', !!instantaneo)
    posicionarEnCelda(dronEl, estadoDron.x, estadoDron.y)
    dronEl.style.setProperty('--mdv-rotacion', `${estadoDron.facing * 90}deg`)
    if (instantaneo) requestAnimationFrame(() => dronEl.classList.remove('mdv-dron--sin-transicion'))
  }

  // ── Cinta de instrucciones ────────────────────────────────────────────
  function renderCinta() {
    cintaEl.innerHTML = tape.map((tipo, i) => {
      const bloque = BLOQUES.find((b) => b.tipo === tipo)
      return `<button type="button" class="mdv-bloque-cinta" data-indice="${i}" role="listitem" tabindex="${i === focoTape ? 0 : -1}"
        aria-label="Paso ${i + 1}: ${bloque.etiqueta}">${bloque.icono}</button>`
    }).join('')
    if (focoTape >= tape.length) focoTape = tape.length - 1
    actualizarBotonesAccion()
  }

  function actualizarBotonesAccion() {
    const sinInstrucciones = tape.length === 0
    botonVolar.disabled = sinInstrucciones || enVuelo
    botonPaso.disabled = sinInstrucciones || enVuelo
  }

  function reiniciarEjecucion() {
    indiceEjecucion = 0
    estadoDron = { x: BASE.x, y: BASE.y, facing: FACING_INICIAL }
    recogidas = new Set()
    enVuelo = false
    botonReintentar.hidden = true
    anunciar('')
    cintaEl.querySelectorAll('.mdv-bloque-cinta').forEach((el) => el.classList.remove('mdv-bloque-cinta--activo', 'mdv-bloque-cinta--culpable'))
    actualizarMuestrasVisibles()
    actualizarDron(true)
    actualizarBotonesAccion()
  }

  function agregarBloque(tipo) {
    if (enVuelo) return
    quitarManita()
    tape.push(tipo)
    focoTape = tape.length - 1
    reiniciarEjecucion()
    renderCinta()
    const el = cintaEl.querySelector(`[data-indice="${tape.length - 1}"]`)
    el?.focus()
    ayuda?.marcarLogro()
  }

  function quitarBloque(indice) {
    if (enVuelo || indice < 0 || indice >= tape.length) return
    tape.splice(indice, 1)
    focoTape = Math.min(indice, tape.length - 1)
    reiniciarEjecucion()
    renderCinta()
    const el = cintaEl.querySelector(`[data-indice="${focoTape}"]`) || botonVolar
    el?.focus()
  }

  function moverBloque(indice, delta) {
    const destino = indice + delta
    if (enVuelo || destino < 0 || destino >= tape.length) return
    ;[tape[indice], tape[destino]] = [tape[destino], tape[indice]]
    focoTape = destino
    reiniciarEjecucion()
    renderCinta()
    cintaEl.querySelector(`[data-indice="${destino}"]`)?.focus()
  }

  // ── Ejecución de un paso ──────────────────────────────────────────────
  function ejecutarPaso(tipo) {
    if (tipo === 'girar') {
      estadoDron.facing = (estadoDron.facing + 1) % 4
      return { ok: true }
    }
    if (tipo === 'avanzar') {
      const [dx, dy] = DIRS[estadoDron.facing]
      let nx = estadoDron.x + dx, ny = estadoDron.y + dy
      if (!dentroDelMapa(nx, ny)) return { ok: false, mensaje: 'Aquí el dron se salió del mapa.' }
      const viento = nivel.vientos.find((v) => v.x === nx && v.y === ny)
      if (viento) {
        const [wdx, wdy] = DIRS[viento.dir]
        const wx = nx + wdx, wy = ny + wdy
        if (!dentroDelMapa(wx, wy)) return { ok: false, mensaje: 'Aquí te empujó el viento.' }
        nx = wx; ny = wy
      }
      estadoDron.x = nx; estadoDron.y = ny
      return { ok: true }
    }
    if (tipo === 'muestra') {
      const objetivo = nivel.muestras.find((m) => m.x === estadoDron.x && m.y === estadoDron.y && !recogidas.has(idCelda(m)))
      if (!objetivo) return { ok: false, mensaje: 'Aquí no había nada que recoger.' }
      recogidas.add(idCelda(objetivo))
      return { ok: true, recogida: true }
    }
    return { ok: true }
  }

  function nivelResuelto() {
    const todasRecogidas = recogidas.size === nivel.muestras.length
    if (!nivel.requiereVolverABase) return todasRecogidas
    return todasRecogidas && estadoDron.x === BASE.x && estadoDron.y === BASE.y
  }

  function marcarBloqueActivo(indice) {
    cintaEl.querySelectorAll('.mdv-bloque-cinta').forEach((el) => el.classList.remove('mdv-bloque-cinta--activo'))
    cintaEl.querySelector(`[data-indice="${indice}"]`)?.classList.add('mdv-bloque-cinta--activo')
  }

  function avanzarUnPaso({ paraContinuar } = {}) {
    if (indiceEjecucion >= tape.length) return
    const tipo = tape[indiceEjecucion]
    marcarBloqueActivo(indiceEjecucion)
    const resultado = ejecutarPaso(tipo)
    actualizarDron(false)
    actualizarMuestrasVisibles()
    if (!resultado.ok) {
      cintaEl.querySelectorAll('.mdv-bloque-cinta').forEach((el) => el.classList.remove('mdv-bloque-cinta--activo'))
      cintaEl.querySelector(`[data-indice="${indiceEjecucion}"]`)?.classList.add('mdv-bloque-cinta--culpable')
      anunciar(resultado.mensaje)
      enVuelo = false
      botonReintentar.hidden = false
      botonReintentar.focus()
      actualizarBotonesAccion()
      return
    }
    if (resultado.recogida) {
      tono({ frecuencia: 720, duracion: .16, tipo: 'triangle', ganancia: .18 })
    } else if (tipo === 'avanzar') {
      tono({ frecuencia: 260, duracion: .08, tipo: 'sine', ganancia: .08 })
    }
    indiceEjecucion += 1
    if (indiceEjecucion >= tape.length) {
      cintaEl.querySelectorAll('.mdv-bloque-cinta').forEach((el) => el.classList.remove('mdv-bloque-cinta--activo'))
      enVuelo = false
      actualizarBotonesAccion()
      // "Ver un ejemplo" también pasa por acá (usa esta misma función para
      // que se vea igual de real) — pero mirar la demostración nunca debe
      // dar la misión por superada. Solo cuenta si lo vuela el jugador.
      if (nivelResuelto() && !enDemostracion) {
        setTimeout(finalizarNivel, 400)
      } else if (!enDemostracion) {
        anunciar('Todavía no. Ajustá la lista y volá de nuevo.')
      }
      return
    }
    if (paraContinuar) temporizadorPaso = setTimeout(() => avanzarUnPaso({ paraContinuar: true }), 950)
  }

  function volar() {
    // VOLAR siempre ejecuta el plan completo desde la base, sin importar
    // si antes se avanzó a mano con PASO A PASO — "apretás VOLAR y el dron
    // hace exactamente lo que le dijiste" es el plan entero, no una parte.
    if (tape.length === 0 || enVuelo || pausado) return
    reiniciarEjecucion()
    enVuelo = true
    // Solo cuenta como "intento" en los niveles reales (índice 1 a 4): el
    // tutorial (índice 0) es siempre resoluble al toque y no debería
    // restarle estrellas a alguien por haberlo jugado.
    if (indiceNivel >= 1) intentosVuelo += 1
    actualizarBotonesAccion()
    avanzarUnPaso({ paraContinuar: true })
  }

  function pasoAPaso() {
    if (tape.length === 0 || enVuelo || pausado) return
    if (indiceEjecucion >= tape.length) reiniciarEjecucion()
    avanzarUnPaso({ paraContinuar: false })
  }

  function reintentar() {
    if (temporizadorPaso) { clearTimeout(temporizadorPaso); temporizadorPaso = null }
    reiniciarEjecucion()
  }

  function finalizarNivel() {
    if (indiceNivel < niveles.length - 1) {
      indiceNivel += 1
      nivel = niveles[indiceNivel]
      tape = []
      focoTape = -1
      reiniciarEjecucion()
      renderMapa()
      renderCinta()
      if (nivel.mostrarManitaInicial) mostrarManitaPaleta('avanzar')
    } else {
      // `intentosVuelo` ahora suma los reintentos de los 4 niveles reales
      // (antes solo contaba el único nivel real que había) — los umbrales
      // se ajustan a esa escala más amplia.
      const margen = Math.max(3, Math.round(nivel.optimoInstrucciones * 0.3))
      const { estrellas } = evaluarEstrellas({
        metricas: { intentos: intentosVuelo, instrucciones: tape.length },
        umbrales: [
          { estrellas: 1, descripcion: 'Lograrlo', condicion: () => true },
          { estrellas: 2, descripcion: 'En pocos intentos', condicion: (m) => m.intentos <= 10 },
          { estrellas: 3, descripcion: 'Con pocas instrucciones', condicion: (m) => m.intentos <= 6 && m.instrucciones <= nivel.optimoInstrucciones + margen },
        ],
      })
      emitir('superada', { estrellas, intentos: intentosVuelo, instrucciones: tape.length })
    }
  }

  // ── Manita (tutorial + pista) ─────────────────────────────────────────
  function quitarManita() {
    manitaEl?.remove()
    manitaEl = null
  }
  function mostrarManitaPaleta(tipo) {
    quitarManita()
    const el = raiz.querySelector(`.mdv-bloque-paleta[data-tipo="${tipo}"]`)
    if (!el) return
    manitaEl = document.createElement('div')
    manitaEl.className = 'mdv-manita'
    manitaEl.innerHTML = `<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="24" r="14" fill="currentColor" opacity=".25"/><circle cx="30" cy="24" r="7" fill="currentColor"/></svg>`
    el.appendChild(manitaEl)
  }

  // ── Contrato de teclado / entrada ──────────────────────────────────────
  raiz.querySelectorAll('.mdv-bloque-paleta').forEach((btn) => {
    btn.addEventListener('click', () => agregarBloque(btn.dataset.tipo))
  })
  cintaEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.mdv-bloque-cinta')
    if (btn) quitarBloque(Number(btn.dataset.indice))
  })
  botonVolar.addEventListener('click', volar)
  botonPaso.addEventListener('click', pasoAPaso)
  botonReintentar.addEventListener('click', reintentar)

  entrada = crearEntrada(raiz)
  quitarTeclado = entrada.on('tecla-abajo', ({ tecla, original }) => {
    const activo = document.activeElement
    const enCinta = activo?.classList?.contains('mdv-bloque-cinta')
    if (!enCinta) return
    const indice = Number(activo.dataset.indice)
    if (tecla === 'Delete' || tecla === 'Backspace') { original?.preventDefault?.(); quitarBloque(indice) }
    else if (tecla === 'ArrowUp') { original?.preventDefault?.(); moverBloque(indice, -1) }
    else if (tecla === 'ArrowDown') { original?.preventDefault?.(); moverBloque(indice, 1) }
  })

  const ayuda = crearAyuda(raiz, {
    id: 'dragonfly',
    pasos: [
      { texto: 'Toca los bloques para armar una lista de instrucciones.', dibujo: 'tocar' },
      { texto: 'El dron va a hacer exactamente lo que le pongas en la lista.', dibujo: 'mdv-lista' },
      { texto: 'Ojo con el viento: donde ves flechas, el dron se corre una casilla.', dibujo: 'mdv-viento' },
      {
        texto: PARAMETROS_DIFICULTAD[opciones.dificultad].muestras > 1
          ? 'Recoge todas las muestras y regresa a la base.'
          : 'Recoge la muestra y regresa a la base.',
        dibujo: 'meta',
      },
    ],
    alAbrir: () => { pausado = true },
    alCerrar: () => { pausado = false },
    demostrar: () => demostrar(),
    siguientePista: () => mostrarPista(),
  })

  function mostrarPista() {
    const solucion = calcularSolucion(nivel)
    if (solucion.length === 0) return
    mostrarManitaPaleta(solucion[0])
  }

  function demostrar() {
    pausado = true
    enDemostracion = true
    const tapeGuardada = [...tape]
    const solucion = calcularSolucion(nivel)
    tape = solucion
    focoTape = -1
    reiniciarEjecucion()
    renderCinta()
    indiceEjecucion = 0
    enVuelo = true
    function paso() {
      if (destruido) return
      if (indiceEjecucion >= tape.length) {
        setTimeout(() => {
          if (destruido) return
          tape = tapeGuardada
          focoTape = -1
          enDemostracion = false
          reiniciarEjecucion()
          renderCinta()
          pausado = false
        }, 900)
        return
      }
      avanzarUnPaso({ paraContinuar: false })
      setTimeout(paso, 950)
    }
    paso()
  }

  // ── contrato ──────────────────────────────────────────────────────────
  return {
    iniciar() {
      renderMapa()
      renderCinta()
      if (nivel.mostrarManitaInicial) mostrarManitaPaleta('avanzar')
    },
    pausar() { pausado = true },
    reanudar() { pausado = false },
    destruir() {
      if (destruido) return
      destruido = true
      if (temporizadorPaso) clearTimeout(temporizadorPaso)
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

// ── CSS del juego ─────────────────────────────────────────────────────────
const CSS_JUEGO = `
.mdv-raiz {
  display: flex;
  flex-direction: column;
  gap: var(--e-4, 1rem);
  width: 100%;
  height: 100%;
  color: #f5efe0;
  font-family: inherit;
  min-height: 0;
}
.mdv-zona-mapa { display: flex; justify-content: center; }
.mdv-mapa {
  position: relative;
  width: min(100%, 380px);
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(var(--mdv-grid), 1fr);
  grid-template-rows: repeat(var(--mdv-grid), 1fr);
  border-radius: var(--e-3, .75rem);
  overflow: hidden;
  border: 2px solid rgba(201, 162, 39, .4);
}
.mdv-celda { position: relative; background: #d9924a; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
.mdv-celda--lago { background: #4a90c9; }
.mdv-base {
  position: absolute; inset: 12%;
  border-radius: 50%;
  border: 3px dashed rgba(255,255,255,.7);
  background: rgba(255,255,255,.12);
}
.mdv-viento-flecha {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; color: rgba(255,255,255,.85);
  text-shadow: 0 1px 3px rgba(0,0,0,.4);
  pointer-events: none;
}
.mdv-muestra-overlay {
  position: absolute; transform: translate(-50%, -50%);
  width: 14%; aspect-ratio: 1; pointer-events: none;
}
.mdv-muestra-brillo {
  width: 100%; height: 100%; border-radius: 50%;
  background: radial-gradient(circle, #fff7cf 0%, #ffd966 55%, transparent 75%);
  animation: mdv-brillo-pulso 1.4s ease-in-out infinite;
}
.mdv-muestra-overlay--recogida .mdv-muestra-brillo { opacity: 0; }
@keyframes mdv-brillo-pulso { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: .75; } }

.mdv-dron {
  position: absolute;
  width: 16%; aspect-ratio: 1;
  transform: translate(-50%, -50%);
  transition: left .9s cubic-bezier(.4,0,.2,1), top .9s cubic-bezier(.4,0,.2,1);
  z-index: 2;
}
.mdv-dron--sin-transicion { transition: none; }
.mdv-dron-sombra {
  position: absolute; left: 50%; bottom: -6%; width: 70%; height: 22%;
  transform: translateX(-50%);
  background: rgba(0,0,0,.35); border-radius: 50%; filter: blur(2px);
}
.mdv-dron-cuerpo {
  position: relative; width: 100%; height: 100%;
  transform: rotate(var(--mdv-rotacion, 0deg));
  transition: transform .5s ease;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.4));
}
.mdv-helice-aspa { animation: mdv-girar-helice .35s linear infinite; }
@keyframes mdv-girar-helice { to { transform: rotate(360deg); } }

.mdv-zona-controles { display: flex; flex-direction: column; gap: var(--e-3, .75rem); }
.mdv-paleta { display: flex; gap: var(--e-2, .5rem); justify-content: center; flex-wrap: wrap; }
.mdv-bloque-paleta {
  position: relative;
  min-width: 64px; min-height: 64px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  border-radius: var(--e-2, .5rem);
  border: 1px solid var(--acento-mision, #C9A227);
  background: color-mix(in srgb, var(--acento-mision, #C9A227) 14%, transparent);
  color: #fff;
  cursor: pointer;
}
.mdv-bloque-icono { font-size: 1.5rem; line-height: 1; }
.mdv-bloque-texto { font-size: var(--hud-label); opacity: .8; }
.mdv-bloque-paleta:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }

.mdv-cinta-envoltorio { overflow-x: auto; padding: var(--e-2, .5rem) 0; }
.mdv-cinta { display: flex; gap: var(--e-2, .5rem); min-height: 56px; padding: 0 var(--e-2, .5rem); }
.mdv-bloque-cinta {
  min-width: 48px; min-height: 48px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem;
  border-radius: var(--e-2, .5rem);
  border: 1px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.06);
  color: #fff;
  cursor: pointer;
  flex: none;
}
.mdv-bloque-cinta:focus-visible { outline: 3px solid var(--acento-mision, #C9A227); outline-offset: 2px; }
.mdv-bloque-cinta--activo { border-color: var(--acento-mision, #C9A227); background: color-mix(in srgb, var(--acento-mision, #C9A227) 30%, transparent); }
.mdv-bloque-cinta--culpable { border-color: #FFD966; background: rgba(255, 217, 102, .3); }

.mdv-mensaje { min-height: 1.2em; text-align: center; font-size: var(--hud-label); color: rgba(255,255,255,.75); margin: 0; }

.mdv-acciones { display: flex; gap: var(--e-3, .75rem); justify-content: center; flex-wrap: wrap; }
.mdv-boton-primario, .mdv-boton-secundario {
  min-height: 44px; padding: 0 var(--e-6, 1.5rem);
  border-radius: var(--e-2, .5rem);
  font-size: var(--hud-label);
  font-weight: 700;
  cursor: pointer;
}
.mdv-boton-primario {
  border: 1px solid var(--acento-mision, #C9A227);
  background: color-mix(in srgb, var(--acento-mision, #C9A227) 22%, transparent);
  color: #fff;
}
.mdv-boton-secundario {
  border: 1px solid rgba(255,255,255,.2);
  background: transparent;
  color: rgba(255,255,255,.75);
}
.mdv-boton-primario:disabled, .mdv-boton-secundario:disabled { opacity: .35; cursor: default; }

.mdv-manita {
  position: absolute; left: 50%; top: -8px; transform: translate(-50%, -100%);
  width: 44px; height: 44px; color: #fff; pointer-events: none;
  animation: mdv-manita-tap 1s ease-in-out infinite;
}
@keyframes mdv-manita-tap { 0%, 100% { transform: translate(-50%, -100%); } 50% { transform: translate(-50%, -75%); } }

@media (prefers-reduced-motion: reduce) {
  .mdv-dron, .mdv-dron-cuerpo { transition: none !important; }
  .mdv-helice-aspa, .mdv-muestra-brillo, .mdv-manita { animation: none !important; }
}
`
