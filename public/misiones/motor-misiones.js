// motor-misiones.js — archivo rey del módulo de misiones.
// Orquesta el registro perezoso de cada minijuego, el modal a pantalla
// completa y sus tres fases (briefing → juego → debriefing), la trampa de
// foco, y las preferencias persistidas (dificultad, modo accesible, silencio,
// mejores estrellas por misión).
//
// Contrato que cumple cada minijuego (ver /juegos):
//   export const meta = { titulo, acento, objetivo, datoInicial, datoCierre }
//   export function crearMision(contenedor, opciones) {
//     // opciones = { dificultad: 1|2|3, modoAccesible: bool, semilla: number }
//     return { iniciar, pausar, reanudar, destruir, on, demostrar, siguientePista }
//   }
//   `demostrar` y `siguientePista` son OPCIONALES: los usa el propio juego para
//   armar su panel de ayuda (ver nucleo/ayuda-paso-a-paso.js) — este motor no
//   los llama directamente, solo carga el módulo y confía en su contrato.
//   eventos emitidos vía on(): 'progreso' (0..1) | 'superada' (metricas, con
//   metricas.estrellas ya calculado por el propio juego vía evaluador-
//   estrellas.js) | 'fallada' (razon) | 'pista'

import { estaSilenciado, establecerSilencio } from './nucleo/audio-mision.js'

const CLAVE_ESTRELLAS = 'astra-mision-estrellas'
const CLAVE_DIFICULTAD = 'astra-mision-dificultad'
const CLAVE_ACCESIBLE = 'astra-mision-accesible'
const CLAVE_SILENCIO = 'astra-mision-silencio'

// Íconos en SVG (no emoji): el emoji de parlante/cerrar se ve distinto según
// SO y fuente instalada — un trazo propio se ve exactamente igual siempre.
const ICONO_SONIDO = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>
  <path d="M16.3 8.7a5 5 0 0 1 0 6.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M19 6a8.7 8.7 0 0 1 0 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
</svg>`
const ICONO_SONIDO_MUDO = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>
  <path d="M16.2 9.2l4.6 4.6M20.8 9.2l-4.6 4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`
const ICONO_CERRAR = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`

const cargadores = new Map() // id -> () => Promise<módulo>
let misionActiva = null

// ── Persistencia ─────────────────────────────────────────────────────────
function leerJSON(clave, porDefecto) {
  try {
    const crudo = localStorage.getItem(clave)
    return crudo === null ? porDefecto : JSON.parse(crudo)
  } catch {
    return porDefecto
  }
}
function guardarJSON(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // localStorage puede fallar en privado/cuota llena — no es crítico, se
    // sigue jugando, solo no se recuerda la preferencia.
  }
}

export function obtenerMejoresEstrellas(id) {
  return leerJSON(CLAVE_ESTRELLAS, {})[id] ?? 0
}
function guardarMejoresEstrellas(id, estrellas) {
  const todas = leerJSON(CLAVE_ESTRELLAS, {})
  if (estrellas > (todas[id] ?? 0)) {
    todas[id] = estrellas
    guardarJSON(CLAVE_ESTRELLAS, todas)
  }
}
export function obtenerDificultadPreferida() {
  return leerJSON(CLAVE_DIFICULTAD, 2)
}
function guardarDificultadPreferida(valor) {
  guardarJSON(CLAVE_DIFICULTAD, valor)
}
export function obtenerModoAccesiblePreferido() {
  return leerJSON(CLAVE_ACCESIBLE, false)
}
function guardarModoAccesiblePreferido(valor) {
  guardarJSON(CLAVE_ACCESIBLE, valor)
}

// ── Registro perezoso ────────────────────────────────────────────────────
/** cargador es una función que retorna el import() dinámico del juego. */
export function registrarMision(id, cargador) {
  cargadores.set(id, cargador)
}

export function misionEstaRegistrada(id) {
  return cargadores.has(id)
}

// ── Trampa de foco ───────────────────────────────────────────────────────
function elementosFocables(raiz) {
  return [...raiz.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
  )].filter((el) => el.offsetParent !== null)
}

function instalarTrampaFoco(modal) {
  function alTeclado(e) {
    if (e.key !== 'Tab') return
    const focables = elementosFocables(modal)
    if (focables.length === 0) return
    const primero = focables[0]
    const ultimo = focables[focables.length - 1]
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }
  modal.addEventListener('keydown', alTeclado)
  return () => modal.removeEventListener('keydown', alTeclado)
}

// ── Construcción del DOM del modal ───────────────────────────────────────
function crearEsqueletoModal(id) {
  const fondo = document.createElement('div')
  fondo.className = 'mision-fondo'
  fondo.dataset.mision = id

  fondo.innerHTML = `
    <div class="mision-modal" role="dialog" aria-modal="true" aria-labelledby="mision-titulo-${id}" tabindex="-1">
      <header class="mision-cabecera">
        <h2 id="mision-titulo-${id}" class="mision-titulo"></h2>
        <div class="mision-controles-header">
          <div class="mision-selector-dificultad" role="group" aria-label="Dificultad">
            <button type="button" data-dificultad="1">N1</button>
            <button type="button" data-dificultad="2">N2</button>
            <button type="button" data-dificultad="3">N3</button>
          </div>
          <label class="mision-toggle-accesible">
            <input type="checkbox" data-accion="accesible" class="mision-toggle-input" />
            <span class="mision-toggle-pista" aria-hidden="true"></span>
            <span class="mision-toggle-texto">Modo accesible</span>
          </label>
          <div class="mision-grupo-iconos">
            <button type="button" class="mision-boton-icono" data-accion="silencio" aria-pressed="false" aria-label="Silenciar sonido">${ICONO_SONIDO}</button>
            <button type="button" class="mision-cerrar" aria-label="Cerrar misión">${ICONO_CERRAR}</button>
          </div>
        </div>
      </header>

      <div class="mision-cuerpo">
        <section class="mision-fase mision-fase-briefing" data-fase="briefing">
          <p class="mision-briefing-objetivo"></p>
          <p class="mision-briefing-dato"></p>
          <button type="button" class="mision-boton-primario" data-accion="comenzar">COMENZAR</button>
        </section>

        <section class="mision-fase mision-fase-juego" data-fase="juego" hidden>
          <div class="mision-contenedor-juego"></div>
        </section>

        <section class="mision-fase mision-fase-debriefing" data-fase="debriefing" hidden>
          <div class="mision-estrellas" aria-hidden="true"></div>
          <p class="mision-debriefing-estado"></p>
          <p class="mision-debriefing-dato"></p>
          <div class="mision-debriefing-acciones">
            <button type="button" class="mision-boton-primario" data-accion="reintentar">REINTENTAR</button>
            <button type="button" class="mision-boton-secundario" data-accion="salir">SALIR</button>
          </div>
        </section>
      </div>
    </div>
  `
  return fondo
}

// ── API pública ──────────────────────────────────────────────────────────
export async function abrirMision(id, opciones = {}) {
  if (misionActiva) cerrarMision()

  const cargador = cargadores.get(id)
  if (!cargador) {
    console.error(`[motor-misiones] no hay ninguna misión registrada con id "${id}"`)
    return
  }

  const ctaOrigen = document.activeElement
  const fondo = crearEsqueletoModal(id)
  document.body.appendChild(fondo)
  document.body.classList.add('mision-abierta')

  const modal = fondo.querySelector('.mision-modal')
  const quitarTrampa = instalarTrampaFoco(modal)

  let dificultad = opciones.dificultad ?? obtenerDificultadPreferida()
  let modoAccesible = opciones.modoAccesible ?? obtenerModoAccesiblePreferido()
  establecerSilencio(leerJSON(CLAVE_SILENCIO, false))

  const nodoBriefing = fondo.querySelector('[data-fase="briefing"]')
  const nodoJuego = fondo.querySelector('[data-fase="juego"]')
  const nodoDebriefing = fondo.querySelector('[data-fase="debriefing"]')
  const contenedorJuego = fondo.querySelector('.mision-contenedor-juego')
  const botonSilencio = fondo.querySelector('[data-accion="silencio"]')
  const botonesDificultad = [...fondo.querySelectorAll('[data-dificultad]')]
  const checkboxAccesible = fondo.querySelector('[data-accion="accesible"]')

  function reflejarControles() {
    botonesDificultad.forEach((b) => {
      const activo = Number(b.dataset.dificultad) === dificultad
      b.setAttribute('aria-pressed', String(activo))
      b.classList.toggle('activo', activo)
    })
    checkboxAccesible.checked = modoAccesible
    botonSilencio.setAttribute('aria-pressed', String(estaSilenciado()))
    botonSilencio.innerHTML = estaSilenciado() ? ICONO_SONIDO_MUDO : ICONO_SONIDO
  }
  reflejarControles()

  botonesDificultad.forEach((b) => {
    b.addEventListener('click', () => {
      dificultad = Number(b.dataset.dificultad)
      guardarDificultadPreferida(dificultad)
      reflejarControles()
    })
  })
  checkboxAccesible.addEventListener('change', () => {
    modoAccesible = checkboxAccesible.checked
    guardarModoAccesiblePreferido(modoAccesible)
  })
  botonSilencio.addEventListener('click', () => {
    establecerSilencio(!estaSilenciado())
    guardarJSON(CLAVE_SILENCIO, estaSilenciado())
    reflejarControles()
  })

  // -- carga perezosa del módulo del juego: el código no se descarga hasta este punto --
  const modulo = await cargador()
  const meta = modulo.meta ?? {}

  fondo.style.setProperty('--acento-mision', meta.acento ?? '#5FD9C4')
  fondo.querySelector('.mision-titulo').textContent = meta.titulo ?? ''
  nodoBriefing.querySelector('.mision-briefing-objetivo').textContent = meta.objetivo ?? ''
  nodoBriefing.querySelector('.mision-briefing-dato').textContent = meta.datoInicial ?? ''

  let instanciaJuego = null

  function mostrarFase(nombre) {
    nodoBriefing.hidden = nombre !== 'briefing'
    nodoJuego.hidden = nombre !== 'juego'
    nodoDebriefing.hidden = nombre !== 'debriefing'
  }

  function iniciarJuego() {
    mostrarFase('juego')
    instanciaJuego = modulo.crearMision(contenedorJuego, {
      dificultad,
      modoAccesible,
      semilla: opciones.semilla ?? Date.now(),
    })
    instanciaJuego.on('superada', (metricas) => mostrarDebriefing(true, metricas))
    instanciaJuego.on('fallada', (razon) => mostrarDebriefing(false, { razon }))
    instanciaJuego.iniciar()
  }

  function mostrarDebriefing(exito, metricas) {
    mostrarFase('debriefing')
    const estrellas = exito ? Math.max(0, Math.min(3, metricas?.estrellas ?? 0)) : 0
    if (exito) {
      guardarMejoresEstrellas(id, estrellas)
      opciones.onSuperada?.({ ...metricas, estrellas })
    }

    // Cada estrella es su propio <span> (no un solo string) para poder
    // animarlas con un pequeño desfase en CSS vía la variable --i.
    fondo.querySelector('.mision-estrellas').innerHTML = Array.from({ length: 3 }, (_, i) =>
      `<span class="mision-estrella" style="--i:${i}">${i < estrellas ? '★' : '☆'}</span>`
    ).join('')
    fondo.querySelector('.mision-debriefing-estado').textContent = exito
      ? 'Misión superada'
      : `Misión no superada${metricas?.razon ? ` — ${metricas.razon}` : ''}`
    fondo.querySelector('.mision-debriefing-dato').textContent = meta.datoCierre ?? ''

    const botonReintentar = fondo.querySelector('[data-accion="reintentar"]')
    if (!exito) botonReintentar.focus()
  }

  fondo.querySelector('[data-accion="comenzar"]').addEventListener('click', iniciarJuego)
  fondo.querySelector('[data-accion="reintentar"]').addEventListener('click', () => {
    instanciaJuego?.destruir()
    instanciaJuego = null
    mostrarFase('briefing')
  })
  fondo.querySelector('[data-accion="salir"]').addEventListener('click', () => cerrarMision())
  fondo.querySelector('.mision-cerrar').addEventListener('click', () => confirmarCierre())

  function confirmarCierre() {
    const enPartida = !nodoJuego.hidden
    if (!enPartida || window.confirm('¿Salir de la misión? Perderás el progreso de esta partida.')) {
      cerrarMision()
    }
  }

  function alTecladoModal(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      confirmarCierre()
    }
  }
  fondo.addEventListener('keydown', alTecladoModal)

  misionActiva = {
    id,
    fondo,
    ctaOrigen,
    quitarTrampa,
    alTecladoModal,
    obtenerInstancia: () => instanciaJuego,
  }

  modal.focus()
}

export function cerrarMision() {
  if (!misionActiva) return
  const { fondo, ctaOrigen, quitarTrampa, alTecladoModal, obtenerInstancia } = misionActiva

  obtenerInstancia()?.destruir()
  quitarTrampa()
  fondo.removeEventListener('keydown', alTecladoModal)
  fondo.remove()
  document.body.classList.remove('mision-abierta')
  misionActiva = null

  if (ctaOrigen && typeof ctaOrigen.focus === 'function') ctaOrigen.focus()
}

/** Solo para tests/depuración. */
export function _misionActivaId() {
  return misionActiva?.id ?? null
}
