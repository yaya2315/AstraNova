'use client'

import { useEffect, useRef } from 'react'

// Favicon animado — mismo diseño y colores que MiniSolarSystem.tsx (el logo
// del menú): Sol al centro, dos anillos de órbita y tres planetas girando.
// Los navegadores NO animan favicons SVG/GIF de forma confiable (casi todos
// se quedan con el primer cuadro) — la única forma real de que "se mueva"
// en la pestaña es dibujarlo en un <canvas> oculto y volcarlo como PNG al
// <link rel="icon"> cada cierto intervalo. Esto sí funciona en Chrome, Edge,
// Opera y Firefox mientras la pestaña siga cargada (no hace falta que esté
// enfocada). src/app/icon.svg queda como ícono estático de respaldo: se ve
// desde el primer instante (antes de hidratar) y sigue ahí si el usuario
// tiene "reducir movimiento" activado o está en celular.
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

    // Se agrega un <link> propio en vez de tocar el que puso Next.js para
    // icon.svg — así ese sigue intacto como respaldo, y el navegador
    // prioriza este (el último rel="icon" en el <head>) apenas monta.
    const link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/png'
    document.head.appendChild(link)

    const t0 = performance.now()
    let raf = 0
    let lastDraw = 0

    const draw = (now: number) => {
      const t = (now - t0) / 1000
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

      link.href = canvas.toDataURL('image/png')
    }

    const loop = (now: number) => {
      // ~10fps alcanza de sobra para verse "vivo" en un ícono de 16-32px y
      // evita generar un PNG nuevo 60 veces por segundo sin necesidad real.
      if (now - lastDraw > 100) { draw(now); lastDraw = now }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      link.remove()
    }
  }, [])

  return null
}
