/**
 * ASTRA NOVA — Motor de navegación y UI
 *
 * Equivalente vanilla JS de los componentes React:
 *   DeepNavEngine.tsx  → DeepNav (motor + contexto)
 *   page.tsx           → DivePortal, DeepNavHUD, LayerStack
 *   LoadingScreen.tsx  → LoadingScreen
 *   SideNav.tsx        → SideNav
 *
 * Conectado en index.html con: <script src="script.js" defer></script>
 */

'use strict'

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ══════════════════════════════════════════════════════════════════════════════

/** IDs de las capas en orden de profundidad (debe coincidir con el HTML) */
const LAYERS = [
  'layer-0',  // Hero
  'layer-1',  // Sistema Solar
  'layer-2',  // Historia Cósmica
  'layer-3',  // Constelaciones
  'layer-4',  // Galería
  'layer-5',  // Misiones
  'layer-6',  // Footer / Contacto
]

/** Etiqueta del DivePortal para cada profundidad (qué hay en la capa siguiente) */
const DIVE_LABELS = [
  'Sistema Solar',
  'Historia Cósmica',
  'Constelaciones',
  'Galería',
  'Misiones',
  'Contacto',
  '',  // Capa 6 no tiene siguiente
]

/** Duración de la animación de transición en ms */
const DIVE_MS = 850


// ══════════════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════════════════

const state = {
  depth:   0,       // Capa activa actual (0 = hero)
  locked:  false,   // Bloqueo durante transición
  reduced: false,   // prefers-reduced-motion
}


// ══════════════════════════════════════════════════════════════════════════════
// CACHÉ DE ELEMENTOS DOM
// ══════════════════════════════════════════════════════════════════════════════

let layerEls    = []   // Elementos .deep-layer
let bgEl        = null // #premium-bg
let hudEl       = null // #deep-nav-hud
let dotsEl      = null // #depth-dots
let portalEl    = null // #dive-portal
let portalLabel = null // #dive-label
let volverBtn   = null // #btn-volver


// ══════════════════════════════════════════════════════════════════════════════
// MOTOR DE NAVEGACIÓN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Aplica data-state a una capa y gestiona aria-hidden.
 * @param {number} idx
 * @param {'out-back' | 'active' | 'out-front'} s
 */
function applyState(idx, s) {
  const el = layerEls[idx]
  if (!el) return
  el.dataset.state = s
  if (s === 'active') {
    el.removeAttribute('aria-hidden')
    el.scrollTop = 0
  } else {
    el.setAttribute('aria-hidden', 'true')
  }
}

/**
 * Alterna la clase .breathed-in en el fondo para el efecto de zoom del universo.
 * @param {boolean} into
 */
function breathe(into) {
  if (state.reduced) return
  bgEl?.classList.toggle('breathed-in', into)
}

/** Duración del lock (reducida si prefers-reduced-motion) */
const lockMs = () => state.reduced ? 320 : DIVE_MS

/** Activa el bloqueo anti-superposición y lo libera tras la duración. */
function lock() {
  state.locked = true
  setTimeout(() => { state.locked = false }, lockMs())
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Avanza una capa hacia las profundidades (solo acepta depth + 1).
 * @param {number} targetIdx
 */
function dive(targetIdx) {
  if (state.locked) return
  if (targetIdx !== state.depth + 1 || targetIdx >= LAYERS.length) return

  lock()
  applyState(state.depth, 'out-front')
  applyState(targetIdx, 'active')
  breathe(true)

  state.depth = targetIdx
  syncUI()
}

/**
 * Vuelve una capa hacia la superficie.
 */
function surface() {
  if (state.locked || state.depth === 0) return
  const prev = state.depth - 1

  lock()
  applyState(state.depth, 'out-back')
  applyState(prev, 'active')
  if (prev === 0) breathe(false)

  state.depth = prev
  syncUI()
}

/**
 * Salto directo a cualquier capa (para el SideNav).
 * @param {number} targetIdx
 */
function jumpTo(targetIdx) {
  if (state.locked) return
  if (targetIdx < 0 || targetIdx >= LAYERS.length) return
  if (targetIdx === state.depth) return

  lock()
  LAYERS.forEach((_, i) => {
    if      (i < targetIdx)   applyState(i, 'out-front')
    else if (i === targetIdx) applyState(i, 'active')
    else                      applyState(i, 'out-back')
  })
  breathe(targetIdx > 0)

  state.depth = targetIdx
  syncUI()
}


// ══════════════════════════════════════════════════════════════════════════════
// SINCRONIZACIÓN DE UI
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Actualiza HUD, DivePortal, SideNav y los puntos de profundidad
 * cada vez que cambia state.depth.
 */
function syncUI() {
  syncHUD()
  syncPortal()
  syncSideNav()
  syncDots()
}

// ─── HUD (↑ Volver + puntos) ─────────────────────────────────────────────────

function syncHUD() {
  if (!hudEl) return
  const visible = state.depth > 0
  hudEl.style.opacity       = visible ? '1' : '0'
  hudEl.style.pointerEvents = visible ? 'auto' : 'none'
}

function syncDots() {
  if (!dotsEl) return
  dotsEl.innerHTML = ''
  LAYERS.forEach((_, i) => {
    const dot     = document.createElement('span')
    const active  = i === state.depth
    const visited = i < state.depth
    dot.style.cssText = `
      display:      inline-block;
      border-radius: 50%;
      transition:   all 0.4s ease;
      width:        ${active ? '6px' : '4px'};
      height:       ${active ? '6px' : '4px'};
      background:   ${active ? '#00F0FF' : visited ? 'rgba(0,240,255,0.28)' : 'rgba(255,255,255,0.10)'};
      margin:       0 2px;
    `
    dotsEl.appendChild(dot)
  })
}

// ─── DivePortal ───────────────────────────────────────────────────────────────

function syncPortal() {
  if (!portalEl) return
  const hasNext = state.depth < LAYERS.length - 1
  portalEl.style.opacity       = hasNext ? '1' : '0'
  portalEl.style.pointerEvents = hasNext ? 'auto' : 'none'
  if (portalLabel) portalLabel.textContent = DIVE_LABELS[state.depth] ?? ''
}

// ─── SideNav ─────────────────────────────────────────────────────────────────

function syncSideNav() {
  const nav = document.getElementById('side-nav')
  if (!nav) return
  nav.querySelectorAll('a').forEach((a, i) => {
    const active = i === state.depth
    a.style.color   = active ? '#00F0FF' : ''
    a.style.opacity = active ? '1' : ''
    a.setAttribute('aria-current', active ? 'page' : 'false')
  })
}


// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA DE CARGA
// ══════════════════════════════════════════════════════════════════════════════

function initLoadingScreen() {
  const screen = document.getElementById('loading-screen')
  if (!screen) return
  setTimeout(() => {
    screen.style.transition = 'opacity 0.6s ease'
    screen.style.opacity    = '0'
    setTimeout(() => { screen.style.display = 'none' }, 600)
  }, 1800)
}


// ══════════════════════════════════════════════════════════════════════════════
// TECLADO
// ══════════════════════════════════════════════════════════════════════════════

function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key !== 'Backspace') return
    if (e.target?.matches?.('input, textarea, [contenteditable]')) return
    e.preventDefault()
    surface()
  })
}


// ══════════════════════════════════════════════════════════════════════════════
// SIDENAV — eventos de click
// ══════════════════════════════════════════════════════════════════════════════

function initSideNav() {
  const nav = document.getElementById('side-nav')
  if (!nav) return
  nav.querySelectorAll('a').forEach((a, i) => {
    a.addEventListener('click', (e) => { e.preventDefault(); jumpTo(i) })
  })
}


// ══════════════════════════════════════════════════════════════════════════════
// DIVE PORTAL — evento de click
// ══════════════════════════════════════════════════════════════════════════════

function initDivePortal() {
  if (!portalEl) return
  portalEl.addEventListener('click', () => {
    if (state.depth < LAYERS.length - 1) dive(state.depth + 1)
  })
}


// ══════════════════════════════════════════════════════════════════════════════
// HUD — botón ↑ Volver
// ══════════════════════════════════════════════════════════════════════════════

function initHUD() {
  if (!volverBtn) return
  volverBtn.addEventListener('click', surface)
  volverBtn.addEventListener('mouseenter', () => {
    volverBtn.style.color       = 'rgba(0,240,255,0.9)'
    volverBtn.style.borderColor = 'rgba(0,240,255,0.40)'
  })
  volverBtn.addEventListener('mouseleave', () => {
    volverBtn.style.color       = 'rgba(0,240,255,0.45)'
    volverBtn.style.borderColor = 'rgba(0,240,255,0.15)'
  })
}


// ══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════════════════════

function init() {
  state.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  layerEls    = LAYERS.map(id => document.getElementById(id))
  bgEl        = document.getElementById('premium-bg')
  hudEl       = document.getElementById('deep-nav-hud')
  dotsEl      = document.getElementById('depth-dots')
  portalEl    = document.getElementById('dive-portal')
  portalLabel = document.getElementById('dive-label')
  volverBtn   = document.getElementById('btn-volver')

  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow            = 'hidden'

  // Estado inicial: capa 0 activa, resto hacia atrás
  LAYERS.forEach((_, i) => applyState(i, i === 0 ? 'active' : 'out-back'))

  initLoadingScreen()
  initKeyboard()
  initSideNav()
  initDivePortal()
  initHUD()
  syncUI()

  // API global (equivalente a window.deepNav en DeepNavEngine.tsx)
  window.deepNav = {
    dive, surface, jumpTo,
    get depth() { return state.depth },
    LAYERS,
  }

  console.info('[ASTRA NOVA] Motor DeepNav iniciado. window.deepNav disponible.')
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
