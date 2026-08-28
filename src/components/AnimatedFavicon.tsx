'use client'

import { useEffect } from 'react'

// Favicon animado — mismo diseño y colores que MiniSolarSystem.tsx (el logo
// del menú): Sol al centro, dos anillos de órbita y tres planetas girando.
// Los navegadores NO animan favicons SVG/GIF de forma confiable (casi todos
// se quedan con el primer cuadro) — la única forma real de que "se mueva"
// en la pestaña es dibujarlo en un <canvas> oculto y volcarlo al ícono de la
// pestaña cada cierto intervalo. src/app/icon.svg queda como ícono estático
// de respaldo: se ve desde el primer instante (antes de hidratar) y sigue
// ahí si el usuario tiene "reducir movimiento" activado o está en celular.
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768
const SIZE = 48
const CENTER = SIZE / 2
const RING_1 = 13, RING_2 = 20

// [radio de órbita, período en segundos, dirección, color, radio del punto]
const PLANETS: [number, number, number, string, number][] = [
  [RING_1, 3.5, 1, '#00F0FF', 2.6],
  [RING_2, 6.5, -1, '#7B61FF', 2.1],
  [RING_2, 10, 1, 'rgba(0,240,255,0.75)', 1.7],
]

export default function AnimatedFavicon() {
  useEffect(() => {
    // Decorativo y solo para computadora: en celular la pestaña casi nunca
    // se ve, y el ícono estático de icon.svg ya cubre bookmarks/PWA ahí.
    if (IS_MOBILE) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // La parte "quieta" del dibujo (anillos + resplandor + núcleo del Sol,
    // con su degradado) se dibuja UNA sola vez en un canvas base y de ahí en
    // adelante cada cuadro solo la copia (drawImage, muy barato) en vez de
    // recalcularla entera 10 veces por segundo — eso era gran parte del
    // costo que causaba el trabado. Por cuadro solo queda dibujar 3 puntos.
    const base = document.createElement('canvas')
    base.width = SIZE; base.height = SIZE
    const bctx = base.getContext('2d')!
    bctx.lineWidth = 1.3
    bctx.strokeStyle = 'rgba(0,240,255,0.4)'
    bctx.beginPath(); bctx.arc(CENTER, CENTER, RING_1, 0, Math.PI * 2); bctx.stroke()
    bctx.strokeStyle = 'rgba(123,97,255,0.32)'
    bctx.beginPath(); bctx.arc(CENTER, CENTER, RING_2, 0, Math.PI * 2); bctx.stroke()
    bctx.fillStyle = 'rgba(255,176,32,0.18)'
    bctx.beginPath(); bctx.arc(CENTER, CENTER, 10, 0, Math.PI * 2); bctx.fill()
    const sunGrad = bctx.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, 7)
    sunGrad.addColorStop(0, '#fff8cc')
    sunGrad.addColorStop(0.55, '#ffb020')
    sunGrad.addColorStop(1, 'rgba(255,176,32,0)')
    bctx.fillStyle = sunGrad
    bctx.beginPath(); bctx.arc(CENTER, CENTER, 7, 0, Math.PI * 2); bctx.fill()

    const canvas = document.createElement('canvas')
    canvas.width = SIZE; canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Reutiliza el MISMO <link rel="icon"> en vez de crear uno nuevo por
    // cuadro. La vez pasada pasar a "un nodo nuevo por cuadro" fue lo que
    // solucionó que se quedara pegado en un solo cuadro — pero esa causa
    // real era que antes había DOS <link rel="icon"> compitiendo Y además
    // se usaba requestAnimationFrame (que se pausa solo en segundo plano);
    // arreglado eso, recrear un nodo del DOM 12 veces por segundo (crear +
    // insertar + borrar) es trabajo de sobra que no hace falta y que en esta
    // página —ya bastante cargada de animaciones continuas (fondo aurora en
    // WebGL, sistema solar 3D, etc.)— se nota como trabas. Con un solo nodo
    // reutilizado alcanza y cuesta mucho menos.
    const original = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    const originalHref = original?.getAttribute('href') ?? null
    const originalType = original?.getAttribute('type') ?? null
    const iconLink: HTMLLinkElement = original ?? document.createElement('link')
    if (!original) {
      iconLink.rel = 'icon'
      document.head.appendChild(iconLink)
    }
    iconLink.type = 'image/png'

    let currentBlobUrl: string | null = null
    let frameId = 0

    const t0 = performance.now()

    const draw = () => {
      const t = (performance.now() - t0) / 1000
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.drawImage(base, 0, 0)

      for (const [r, period, dir, color, size] of PLANETS) {
        const a = dir * (t / period) * Math.PI * 2
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r, size, 0, Math.PI * 2)
        ctx.fill()
      }

      const thisFrame = ++frameId
      canvas.toBlob((blob) => {
        if (!blob || thisFrame !== frameId) return
        const url = URL.createObjectURL(blob)
        iconLink.href = url
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
        currentBlobUrl = url
      }, 'image/png')
    }

    // setInterval en vez de requestAnimationFrame: rAF se pausa por completo
    // en cuanto la pestaña pierde el foco o pasa a segundo plano — acá
    // interesa que el ícono siga "vivo" incluso sin estar mirándolo. El
    // ritmo se bajó a ~5 cuadros por segundo (200ms): para algo tan chico y
    // que gira tan despacio no hace falta más, y competir menos seguido por
    // el hilo principal del navegador es lo que de verdad evita las trabas
    // en una página con tantas animaciones corriendo a la vez.
    draw()
    const interval = setInterval(draw, 200)
    // Al volver a la pestaña (o si el navegador frenó el intervalo mientras
    // estuvo en segundo plano), fuerza un cuadro fresco de inmediato.
    const onVisible = () => { if (!document.hidden) draw() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
      if (originalHref !== null) {
        iconLink.setAttribute('href', originalHref)
        if (originalType !== null) iconLink.setAttribute('type', originalType)
      } else {
        iconLink.remove()
      }
    }
  }, [])

  return null
}
