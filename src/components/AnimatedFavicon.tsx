'use client'

import { useEffect } from 'react'

// Favicon animado — mismo diseño y colores que MiniSolarSystem.tsx (el logo
// del menú): Sol al centro, dos anillos de órbita y tres planetas girando.
// Los navegadores NO animan favicons SVG/GIF de forma confiable (casi todos
// se quedan con el primer cuadro) — la única forma real de que "se mueva"
// en la pestaña es dibujarlo en un <canvas> oculto y volcarlo como PNG al
// ícono de la pestaña cada cierto intervalo. src/app/icon.svg queda como
// ícono estático de respaldo: se ve desde el primer instante (antes de
// hidratar) y sigue ahí si el usuario tiene "reducir movimiento" activado o
// está en celular.
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768
const SIZE = 64
const CENTER = SIZE / 2

// [radio de órbita, período en segundos, dirección, color, radio del punto]
const PLANETS: [number, number, number, string, number][] = [
  [18, 3.5, 1, '#00F0FF', 3.4],
  [27, 6.5, -1, '#7B61FF', 2.7],
  [27, 10, 1, 'rgba(0,240,255,0.75)', 2.2],
]

export default function AnimatedFavicon() {
  useEffect(() => {
    // Decorativo y solo para computadora: en celular la pestaña casi nunca
    // se ve, y el ícono estático de icon.svg ya cubre bookmarks/PWA ahí.
    if (IS_MOBILE) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Guarda el ícono original (icon.svg) tal cual estaba en el HTML, para
    // devolverlo intacto si este componente se desmonta.
    const original = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    const originalOuterHTML = original?.outerHTML ?? null
    original?.remove()

    // A diferencia del intento anterior (reescribir el `href` de un mismo
    // <link>), acá se crea un <link> NUEVO en cada cuadro y se borra el
    // anterior recién después de insertar el que sigue. Varios Chromium
    // (Chrome, Edge, Opera — el navegador de la captura) dejan de redibujar
    // el ícono de la pestaña si solo se le cambia el `href` al mismo nodo
    // repetidas veces; forzando un nodo <link> distinto por cuadro, el
    // navegador sí lo nota y lo repinta cada vez. Es la técnica que de verdad
    // funciona para favicons animados vía canvas.
    let currentLink: HTMLLinkElement | null = null

    const t0 = performance.now()

    const draw = () => {
      const t = (performance.now() - t0) / 1000
      ctx.clearRect(0, 0, SIZE, SIZE)

      // Anillos de órbita
      ctx.lineWidth = 1.4
      ctx.strokeStyle = 'rgba(0,240,255,0.4)'
      ctx.beginPath(); ctx.arc(CENTER, CENTER, 18, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = 'rgba(123,97,255,0.32)'
      ctx.beginPath(); ctx.arc(CENTER, CENTER, 27, 0, Math.PI * 2); ctx.stroke()

      // Sol (halo + núcleo con degradado, igual que MiniSolarSystem)
      ctx.fillStyle = 'rgba(255,176,32,0.18)'
      ctx.beginPath(); ctx.arc(CENTER, CENTER, 13, 0, Math.PI * 2); ctx.fill()
      const sunGrad = ctx.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, 9)
      sunGrad.addColorStop(0, '#fff8cc')
      sunGrad.addColorStop(0.55, '#ffb020')
      sunGrad.addColorStop(1, 'rgba(255,176,32,0)')
      ctx.fillStyle = sunGrad
      ctx.beginPath(); ctx.arc(CENTER, CENTER, 9, 0, Math.PI * 2); ctx.fill()

      // Planetas orbitando — mismos períodos/sentidos que MiniSolarSystem.tsx
      for (const [r, period, dir, color, size] of PLANETS) {
        const a = dir * (t / period) * Math.PI * 2
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r, size, 0, Math.PI * 2)
        ctx.fill()
      }

      const next = document.createElement('link')
      next.rel = 'icon'
      next.type = 'image/png'
      next.href = canvas.toDataURL('image/png')
      document.head.appendChild(next)
      currentLink?.remove()
      currentLink = next
    }

    // setInterval en vez de requestAnimationFrame: rAF se pausa por completo
    // en cuanto la pestaña pierde el foco o pasa a segundo plano — acá
    // interesa que el ícono siga "vivo" incluso sin estar mirándolo.
    draw()
    const interval = setInterval(draw, 100)
    // Al volver a la pestaña (o si el navegador frenó el intervalo mientras
    // estuvo en segundo plano), fuerza un cuadro fresco de inmediato.
    const onVisible = () => { if (!document.hidden) draw() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      currentLink?.remove()
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
