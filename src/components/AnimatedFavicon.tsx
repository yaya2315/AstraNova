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

    // Guarda el ícono original (icon.svg) tal cual estaba en el HTML, para
    // devolverlo intacto si este componente se desmonta.
    const original = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    const originalOuterHTML = original?.outerHTML ?? null
    original?.remove()

    // Se sigue creando un <link> nuevo por cuadro (varios Chromium no
    // repintan el ícono si solo se le cambia el `href` al mismo nodo), pero
    // ahora con un blob: URL en vez de una data: URI en base64 — codificar
    // y pegar un string base64 gigante en el DOM en cada cuadro es más
    // lento que generar un blob binario, así que este cambio también ayuda
    // a que no se sienta lagueado. Los blob: URLs viejos se liberan
    // (revokeObjectURL) para no ir acumulando memoria.
    let currentLink: HTMLLinkElement | null = null
    let currentBlobUrl: string | null = null
    // toBlob es async — si un cuadro tarda más que el siguiente en resolver,
    // este contador evita que ese cuadro viejo pise al más nuevo (se vería
    // como un pequeño "salto atrás" en la órbita).
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
        const next = document.createElement('link')
        next.rel = 'icon'
        next.type = 'image/png'
        next.href = url
        document.head.appendChild(next)
        currentLink?.remove()
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
        currentLink = next
        currentBlobUrl = url
      }, 'image/png')
    }

    // setInterval en vez de requestAnimationFrame: rAF se pausa por completo
    // en cuanto la pestaña pierde el foco o pasa a segundo plano — acá
    // interesa que el ícono siga "vivo" incluso sin estar mirándolo.
    // ~12 cuadros por segundo: con el canvas base pre-dibujado y los blobs
    // en vez de base64, este ritmo ya no genera el trabado de antes y se ve
    // notoriamente más fluido que los 10fps originales.
    draw()
    const interval = setInterval(draw, 80)
    // Al volver a la pestaña (o si el navegador frenó el intervalo mientras
    // estuvo en segundo plano), fuerza un cuadro fresco de inmediato.
    const onVisible = () => { if (!document.hidden) draw() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      currentLink?.remove()
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
      if (originalOuterHTML) {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = originalOuterHTML
        const restored = wrapper.firstElementChild
        if (restored) document.head.appendChild(restored)
      }
    }
  }, [])

  return null
}
