'use client'

import { useEffect } from 'react'

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

    // Reutiliza el MISMO <link rel="icon"> que Next.js ya puso en el <head>
    // para icon.svg, en vez de agregar uno nuevo al lado — con dos links de
    // ícono compitiendo, la mayoría de los navegadores se quedan mostrando
    // el primero para siempre y nunca notan los cambios en el segundo (por
    // eso se veía estático). Sobreescribiendo el href del mismo elemento,
    // el navegador sí lo redibuja cada vez.
    const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    const originalHref = existing?.getAttribute('href') ?? null
    const originalType = existing?.getAttribute('type') ?? null
    const iconLink: HTMLLinkElement = existing ?? document.createElement('link')
    if (!existing) {
      iconLink.rel = 'icon'
      document.head.appendChild(iconLink)
    }
    iconLink.type = 'image/png'

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

      iconLink.href = canvas.toDataURL('image/png')
    }

    // setInterval en vez de requestAnimationFrame a propósito: rAF se PAUSA
    // por completo en cuanto la pestaña pierde el foco o pasa a segundo
    // plano (por diseño del navegador, para ahorrar batería) — por eso el
    // ícono giraba un poco al cargar y luego se quedaba congelado apenas el
    // usuario dejaba de mirar esa pestaña. setInterval sigue corriendo en
    // segundo plano (como mucho el navegador lo espacía un poco más), que es
    // justo lo que hace falta para que seguir "girando" tenga sentido: un
    // ícono animado que solo se mueve con la pestaña activa no cumple su
    // propósito.
    draw()
    const interval = setInterval(draw, 100)

    return () => {
      clearInterval(interval)
      // Se restaura el ícono estático original (icon.svg) en vez de borrar
      // el <link> — es el mismo elemento que usa el resto del sitio, no uno
      // exclusivo de este componente.
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
