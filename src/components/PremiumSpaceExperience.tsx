'use client'

import { useEffect, useRef } from 'react'
import AuroraBg from './AuroraBg'

// ── Export ─────────────────────────────────────────────────────────────────────
//
// Z-index stack inside #premium-bg:
//   parallax wrapper  → auto  (layer 0 — Aurora WebGL, offset by cursor)
//   vignette div      → 6     (layer 1 — edge darkening, fixed)
//
// El wrapper de parallax es un elemento propio (no #premium-bg mismo) porque
// DeepNavEngine ya anima el transform de #premium-bg (.breathed-in → scale al
// bucear) — un transform inline por mousemove ahí pisaría esa animación vía
// especificidad. Al vivir en un hijo separado, ambos transforms conviven.
export default function PremiumSpaceExperience() {
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const nx = e.clientX / window.innerWidth - 0.5   // -0.5..0.5
        const ny = e.clientY / window.innerHeight - 0.5
        const el = parallaxRef.current
        if (el) el.style.transform = `translate3d(${nx * -16}px, ${ny * -16}px, 0)`
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      id="premium-bg"
      className="fixed inset-0 z-0 overflow-hidden"
      style={{ background: '#04060a' }}
    >
      {/* Layer 0 — Aurora WebGL shader, con parallax 3D sutil (±8px) guiado por el cursor */}
      <div
        ref={parallaxRef}
        className="absolute -inset-4"
        style={{ willChange: 'transform', transition: 'transform 0.6s cubic-bezier(0.22,1,0.36,1)' }}
      >
        <AuroraBg />
      </div>

      {/* Layer 1 — Radial vignette: deepens screen edges */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 6,
          background:
            'radial-gradient(ellipse 78% 78% at 50% 50%, transparent 25%, rgba(4,6,10,0.72) 100%)',
        }}
      />
    </div>
  )
}
