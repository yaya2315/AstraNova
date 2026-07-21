'use client'

import AuroraBg from './AuroraBg'

// ── Export ─────────────────────────────────────────────────────────────────────
//
// Z-index stack inside #premium-bg:
//   AuroraBg canvas   → auto  (layer 0 — base atmosphere, WebGL)
//   StarField canvas  → 2     (layer 1 — stars, parallax, bloom, shooting stars)
//   vignette div      → 6     (layer 2 — edge darkening)
//
export default function PremiumSpaceExperience() {
  return (
    <div
      id="premium-bg"
      className="fixed inset-0 z-0 overflow-hidden"
      style={{ background: '#04060a' }}
    >
      {/* Layer 0 — Aurora WebGL shader */}
      <AuroraBg />

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
