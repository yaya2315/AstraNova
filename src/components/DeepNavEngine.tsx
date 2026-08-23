'use client'

import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ── REGISTRO ──────────────────────────────────────────────────────────────────
// IDs de las capas en orden de profundidad.
// AGREGAR UNA CAPA: añadir su id aquí + <div id="..." class="deep-layer"> en page.tsx.
export const LAYERS = [
  'layer-0', // Hub / Hero
  'layer-1', // Sistema Solar
  'layer-2', // Historia Cósmica
  'layer-3', // Constelaciones
  'layer-4', // Galería
  'layer-5', // Misiones
  'layer-6', // Footer / Contacto
] as const

// Duración del transform (la transición más larga de las dos).
// El lock de transición usa este valor para evitar superposiciones.
const DIVE_MS = 850

// ── CONTEXTO ──────────────────────────────────────────────────────────────────
interface DeepNavCtx {
  depth:   number
  // Avance secuencial: solo acepta depth + 1.
  // Úsalo para el disparador de contenido ("bucear" un nivel).
  dive:    (targetIndex: number) => void
  // Vuelve una capa hacia la superficie.
  surface: () => void
  // Salto directo: acepta cualquier índice.
  // Úsalo para la navegación principal (SideNav, header).
  jumpTo:  (targetIndex: number) => void
  // Capa 2 (overlays: puzzle, misión activa, etc.) — difumina/oscurece la
  // capa activa (Capa 1) detrás del overlay. Llamar con `true` al abrir y
  // `false` al cerrar/desmontar el overlay.
  setOverlayOpen: (open: boolean) => void
}

const Ctx = createContext<DeepNavCtx | null>(null)

export function useDeepNav() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDeepNav used outside <DeepNavProvider>')
  return c
}

// ── MOTOR ─────────────────────────────────────────────────────────────────────
export function DeepNavProvider({ children }: { children: React.ReactNode }) {
  const [depth, setDepth] = useState(0)
  const depthRef  = useRef(0)
  const locked    = useRef(false)
  const reduced   = useRef(false)
  // Cache de elementos — evita getElementById en cada transición (O(n) por llamada).
  const layerEls  = useRef<(HTMLElement | null)[]>([])
  const bgEl      = useRef<HTMLElement | null>(null)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Poblar la caché una sola vez al montar.
    layerEls.current = LAYERS.map(id => document.getElementById(id))
    bgEl.current     = document.getElementById('premium-bg')
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  const lockMs = () => (reduced.current ? 320 : DIVE_MS)

  // Escribe data-state en la capa; aria-hidden se actualiza fuera de la ruta crítica.
  const applyState = useCallback(
    (idx: number, state: 'out-back' | 'active' | 'out-front') => {
      const el = layerEls.current[idx]
      if (!el) return
      el.dataset.state = state
      // Defensivo: si el usuario navega mientras un overlay quedó abierto,
      // no queremos una capa desenfocada para siempre.
      el.classList.remove('layer-dimmed')
      if (state === 'active') {
        el.removeAttribute('aria-hidden')
        requestAnimationFrame(() => { el.scrollTop = 0 })
        // El motor solo anima `transform` (scale), que no dispara ResizeObserver.
        // Un <canvas> (Three.js, mapas, etc.) montado mientras la capa estaba en
        // scale(0.4) queda con el tamaño equivocado para siempre si no se le avisa.
        // Se dispara al activar y de nuevo cuando termina la transición.
        window.dispatchEvent(new Event('resize'))
        setTimeout(() => window.dispatchEvent(new Event('resize')), lockMs())
      } else {
        el.setAttribute('aria-hidden', 'true')
      }
    },
    [],
  )

  // Fondo: agrega o quita la clase .breathed-in que escala el universo.
  const breathe = useCallback((into: boolean) => {
    if (reduced.current) return
    bgEl.current?.classList.toggle('breathed-in', into)
  }, [])

  // Capa 2: difumina/oscurece la capa activa cuando un overlay se abre encima.
  const setOverlayOpen = useCallback((open: boolean) => {
    layerEls.current[depthRef.current]?.classList.toggle('layer-dimmed', open)
  }, [])

  // ── PROFUNDIZAR (secuencial) ─────────────────────────────────────────────
  // La capa actual pasa a out-front (crece, se disuelve hacia el espectador).
  // La capa destino pasa de out-back a active (emerge desde las profundidades).
  // Ambas transiciones ocurren simultáneamente — zoom bidireccional.
  const dive = useCallback((targetIdx: number) => {
    if (locked.current) return
    const cur = depthRef.current
    if (targetIdx !== cur + 1 || targetIdx >= LAYERS.length) return

    locked.current = true
    setTimeout(() => { locked.current = false }, lockMs())

    applyState(cur, 'out-front')
    applyState(targetIdx, 'active')
    breathe(true)

    depthRef.current = targetIdx
    startTransition(() => setDepth(targetIdx))
  }, [applyState, breathe]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── VOLVER (una capa) ────────────────────────────────────────────────────
  // Inverso de dive: la actual retrocede a out-back, la anterior regresa de out-front a active.
  // La capa anterior YA estaba en out-front desde que la atravesamos;
  // cambiar a active dispara la transición CSS directamente (no hay reflow necesario).
  const surface = useCallback(() => {
    if (locked.current || depthRef.current === 0) return
    const cur  = depthRef.current
    const prev = cur - 1

    locked.current = true
    setTimeout(() => { locked.current = false }, lockMs())

    applyState(cur, 'out-back')
    applyState(prev, 'active')
    if (prev === 0) breathe(false) // exhala el fondo solo al volver a la superficie

    depthRef.current = prev
    startTransition(() => setDepth(prev))
  }, [applyState, breathe]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SALTO DIRECTO (navegación principal) ─────────────────────────────────
  // Coloca todas las capas en el estado correcto de una vez:
  //   capas anteriores → out-front
  //   capa destino     → active
  //   capas siguientes → out-back
  const jumpTo = useCallback((targetIdx: number) => {
    if (locked.current) return
    if (targetIdx < 0 || targetIdx >= LAYERS.length) return
    if (targetIdx === depthRef.current) return

    locked.current = true
    setTimeout(() => { locked.current = false }, lockMs())

    LAYERS.forEach((_, i) => {
      if (i < targetIdx)        applyState(i, 'out-front')
      else if (i === targetIdx) applyState(i, 'active')
      else                      applyState(i, 'out-back')
    })
    breathe(targetIdx > 0)

    depthRef.current = targetIdx
    startTransition(() => setDepth(targetIdx))
  }, [applyState, breathe]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── INICIALIZACIÓN ───────────────────────────────────────────────────────
  useEffect(() => {
    LAYERS.forEach((_, i) => applyState(i, i === 0 ? 'active' : 'out-back'))
  }, [applyState])

  // ── TECLADO ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Backspace') return
      if ((e.target as HTMLElement)?.matches?.('input,textarea,[contenteditable]')) return
      e.preventDefault()
      surface()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [surface])

  // ── API GLOBAL ───────────────────────────────────────────────────────────
  // Exponemos dive/surface/jumpTo en window.deepNav para reconectarlos fácilmente
  // a un mando de gamepad o gaze de visor XR sin tocar el motor interno.
  useEffect(() => {
    ;(window as Window & typeof globalThis & { deepNav?: unknown }).deepNav = {
      dive, surface, jumpTo,
      get depth() { return depthRef.current },
      LAYERS,
    }
  }, [dive, surface, jumpTo])

  return <Ctx.Provider value={{ depth, dive, surface, jumpTo, setOverlayOpen }}>{children}</Ctx.Provider>
}
