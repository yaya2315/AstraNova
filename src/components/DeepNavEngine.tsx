'use client'

import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

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

// ── MODELO DE PROFUNDIDAD — cubierta de observación en primera persona ──────
// Cada capa recibe un "bucket" según su distancia (sin signo) a la capa activa:
//   0 → active   (al frente, translateZ(120px) hacia el usuario, sin rotar)
//   1 → peek-1   (retrocede al espacio profundo, inclinada, clickeable)
//   2 → peek-2   (más atrás/desenfocada, también clickeable)
//   3+ → hidden  (fuera de vista — sin esto las 7 capas se verían a la vez)
//
// La capa ACTIVA avanza en Z pero NUNCA rota ni escala de forma persistente —
// solo un tilt/scale permanente rompería la precisión de coordenadas de mouse
// en el Laboratorio de Constelaciones (dibuja con matemática de canvas 2D
// cruda vía getBoundingClientRect) y el drag de OrbitControls del Sistema
// Solar. El translateZ(120px) SÍ magnifica ligeramente el elemento por la
// perspectiva (~7%, previsible y estable, no una distorsión angular como
// rotar) — el creador de constelaciones ya compensa ese factor de escala en
// su lectura de clicks (ver ConstellationCreator más abajo en Sections.tsx),
// y el hitbox de los planetas del Sistema Solar ya es generoso (1.8×) así que
// tolera perfectamente ese margen sin tocar su código.
type Bucket = 'active' | 'peek-1' | 'peek-2' | 'hidden'

function bucketFor(distance: number): Bucket {
  if (distance === 0) return 'active'
  if (distance === 1) return 'peek-1'
  if (distance === 2) return 'peek-2'
  return 'hidden'
}

// z-index de pintado por bucket — NO es decorativo, es necesario: cada
// .deep-layer tiene `overflow-y: auto`, y por spec de CSS cualquier valor de
// overflow distinto de "visible" saca a ese elemento del contexto 3D del
// padre (transform-style: preserve-3d deja de "verlo" para ordenar por Z).
// Sin esto, el orden de pintado/hit-testing cae al orden del DOM sin importar
// el translateZ real — una capa detrás podía terminar recibiendo los clics
// (y el scroll) en vez de la activa.
const BUCKET_Z: Record<Bucket, number> = { active: 4, 'peek-1': 3, 'peek-2': 2, hidden: 1 }

const BUCKET_STYLE: Record<Bucket, { z: number; y: number; scale: number; rotateX: number; rotateZ: number; opacity: number; filter: string }> = {
  active:   { z: 120,  y: 0,  scale: 1,    rotateX: 0,  rotateZ: 0,  opacity: 1,    filter: 'blur(0px)' },
  // La capa siguiente NO debe verse en reposo (opacity 0, como "hidden") —
  // solo se hace visible mientras se anima hacia/desde "active" (el propio
  // animate() interpola opacity 0→1 durante esa transición). Position/rotate
  // quedan listos para cuando le toque entrar, pero no hay peek permanente.
  'peek-1': { z: -150, y: 20, scale: 0.97, rotateX: 10, rotateZ: -2, opacity: 0,    filter: 'blur(12px)' },
  'peek-2': { z: -300, y: 40, scale: 0.94, rotateX: 16, rotateZ: -4, opacity: 0.15, filter: 'blur(12px)' },
  hidden:   { z: -450, y: 60, scale: 0.90, rotateX: 22, rotateZ: -6, opacity: 0,    filter: 'blur(12px)' },
}

// Transición larga y suave (1.2s con esta curva: arranca rápido, aterriza muy
// despacio) — se siente como avanzar físicamente dentro de la cubierta en vez
// de un simple corte. Nota: son parámetros de tween (duration + curva bezier),
// no de spring real (un spring de Framer Motion no toma una curva bezier) —
// se implementa así para respetar EXACTAMENTE los valores pedidos.
const SPRING = { duration: 1.2, ease: [0.16, 1, 0.3, 1] as const }
const REDUCED_TRANSITION = { duration: 0.2, ease: 'easeOut' as const }
const OVERLAY_TRANSITION = { duration: 0.4, ease: 'easeOut' as const }

// ── CONTEXTO ──────────────────────────────────────────────────────────────────
interface DeepNavCtx {
  depth:   number
  // Avance secuencial: solo acepta depth + 1.
  // Úsalo para el disparador de contenido ("bucear" un nivel).
  dive:    (targetIndex: number) => void
  // Vuelve una capa hacia la superficie.
  surface: () => void
  // Salto directo: acepta cualquier índice.
  // Úsalo para la navegación principal (SideNav, header, o clic en una
  // tarjeta del mazo que está asomando detrás).
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
  const depthRef   = useRef(0)
  const locked     = useRef(false)
  const reduced    = useRef(false)
  const overlayOpenRef = useRef(false)
  // Cache de elementos — evita getElementById en cada transición (O(n) por llamada).
  const layerEls   = useRef<(HTMLElement | null)[]>([])
  const bgEl       = useRef<HTMLElement | null>(null)
  const stackEl    = useRef<HTMLElement | null>(null)
  // goTo se define después de applyLayer, pero applyLayer necesita poder
  // disparar una navegación al hacer clic en una capa que asoma detrás —
  // un ref rompe la dependencia circular sin recrear closures en cada render.
  const goToRef    = useRef<(idx: number) => void>(() => {})

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Poblar la caché una sola vez al montar.
    layerEls.current = LAYERS.map(id => document.getElementById(id))
    bgEl.current     = document.getElementById('premium-bg')
    stackEl.current  = document.getElementById('deep-stack')
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  // ── PARALLAX DE MOUSE — inclina el STACK completo (±5°), nunca las capas
  // individuales. Vive en el contenedor para no interferir con las coordenadas
  // de mouse que sí importan (drag del Sistema Solar, clics del creador de
  // constelaciones) — esas matemáticas leen la capa activa, no el stack.
  useEffect(() => {
    if (reduced.current) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const nx = e.clientX / window.innerWidth - 0.5   // -0.5..0.5
        const ny = e.clientY / window.innerHeight - 0.5
        const el = stackEl.current
        if (el) el.style.transform = `rotateY(${nx * 5}deg) rotateX(${-ny * 5}deg)`
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf) }
  }, [])

  // Aplica el bucket de profundidad a una capa: aria-hidden, pointer-events,
  // clic-para-activar en capas que asoman, y la animación spring real del
  // transform/opacity/filter (vía framer-motion, no CSS — así conseguimos
  // physics real en vez de una curva bezier aproximada).
  const applyLayer = useCallback((idx: number, bucket: Bucket) => {
    const el = layerEls.current[idx]
    if (!el) return
    const s = BUCKET_STYLE[bucket]
    const isActive = bucket === 'active'
    const isPeek   = bucket === 'peek-1' || bucket === 'peek-2'

    el.dataset.depth = bucket
    if (isActive) {
      el.removeAttribute('aria-hidden')
      requestAnimationFrame(() => { el.scrollTop = 0 })
      // Un <canvas> (Three.js, mapas, etc.) montado mientras la capa estaba
      // reducida queda con el tamaño equivocado para siempre si no se le avisa.
      window.dispatchEvent(new Event('resize'))
      setTimeout(() => window.dispatchEvent(new Event('resize')), reduced.current ? 220 : 1200)
    } else {
      el.setAttribute('aria-hidden', 'true')
    }

    el.style.zIndex = String(BUCKET_Z[bucket])
    el.style.pointerEvents = isActive || isPeek ? 'auto' : 'none'
    el.style.cursor = isPeek ? 'pointer' : ''
    // Clic en cualquier parte de una capa que asoma → la trae al frente.
    el.onclick = isPeek ? () => goToRef.current(idx) : null

    const activeFilter = isActive && overlayOpenRef.current ? 'blur(20px) brightness(0.6)' : s.filter

    if (reduced.current) {
      animate(el, { opacity: s.opacity }, REDUCED_TRANSITION)
    } else {
      animate(
        el,
        { x: 0, y: s.y, z: s.z, scale: s.scale, rotateX: s.rotateX, rotateZ: s.rotateZ, opacity: s.opacity, filter: activeFilter },
        SPRING,
      )
    }
  }, [])

  // Fondo: agrega o quita la clase .breathed-in que escala el universo.
  const breathe = useCallback((into: boolean) => {
    if (reduced.current) return
    bgEl.current?.classList.toggle('breathed-in', into)
  }, [])

  // Capa 2: difumina/oscurece la capa activa cuando un overlay se abre encima.
  // El filtro de reposo de la capa activa es JS-driven (animate()), así que
  // esto también anima vía JS en vez de una clase CSS — si mezcláramos los
  // dos, el estilo inline que escribe animate() siempre ganaría por
  // especificidad y la clase CSS nunca se vería.
  const setOverlayOpen = useCallback((open: boolean) => {
    overlayOpenRef.current = open
    const el = layerEls.current[depthRef.current]
    if (!el) return
    animate(el, { filter: open ? 'blur(20px) brightness(0.6)' : 'blur(0px)' },
      reduced.current ? REDUCED_TRANSITION : OVERLAY_TRANSITION)
  }, [])

  // ── NAVEGACIÓN CENTRAL — recalcula el bucket de TODAS las capas respecto
  // al nuevo objetivo. A diferencia del motor anterior (que solo tocaba 2
  // capas por transición), acá cualquier capa puede pasar a asomar o dejar
  // de asomar según su nueva distancia al objetivo, así que se recorren todas.
  const goTo = useCallback((targetIdx: number) => {
    if (locked.current) return
    if (targetIdx < 0 || targetIdx >= LAYERS.length) return
    if (targetIdx === depthRef.current) return

    locked.current = true
    setTimeout(() => { locked.current = false }, reduced.current ? 260 : 1200)

    LAYERS.forEach((_, i) => applyLayer(i, bucketFor(Math.abs(i - targetIdx))))
    breathe(targetIdx > 0)

    depthRef.current = targetIdx
    startTransition(() => setDepth(targetIdx))
  }, [applyLayer, breathe])

  useEffect(() => { goToRef.current = goTo }, [goTo])

  // Salto directo: cualquier índice. Navegación principal (SideNav, header,
  // clic en una capa que asoma detrás).
  const jumpTo = goTo

  // Profundizar: solo acepta el siguiente índice en secuencia.
  const dive = useCallback((targetIdx: number) => {
    if (targetIdx !== depthRef.current + 1) return
    goTo(targetIdx)
  }, [goTo])

  // Volver una capa hacia la superficie.
  const surface = useCallback(() => {
    if (depthRef.current === 0) return
    goTo(depthRef.current - 1)
  }, [goTo])

  // ── INICIALIZACIÓN ───────────────────────────────────────────────────────
  useEffect(() => {
    LAYERS.forEach((_, i) => applyLayer(i, bucketFor(i)))
  }, [applyLayer])

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
