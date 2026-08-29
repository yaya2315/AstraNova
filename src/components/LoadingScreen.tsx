'use client'

import { useEffect, useState } from 'react'

const MIN_MS = 2600

export default function LoadingScreen() {
  const [exiting, setExiting] = useState(false)
  const [gone,    setGone]    = useState(false)

  // body.ls-pre is already on the <body> from layout.tsx (server-rendered),
  // so the stack + bg are hidden from the very first paint — no JS needed for that.
  useEffect(() => {
    // Reveal after MIN_MS regardless of load state — waiting for the 'load' event
    // is unreliable when Three.js WebGL keeps resources "pending" indefinitely.
    const timer = setTimeout(() => {
      document.getElementById('deep-stack')?.classList.add('ls-revealing')
      document.getElementById('premium-bg')?.classList.add('ls-revealing')
      document.body.classList.remove('ls-pre')
      setExiting(true)
      setTimeout(() => setGone(true), 680)
    }, MIN_MS)

    return () => clearTimeout(timer)
  }, [])

  if (gone) return null

  return (
    <div
      style={{
        position:     'fixed',
        inset:        0,
        zIndex:       10000,
        display:      'flex',
        flexDirection:'column',
        alignItems:   'center',
        justifyContent:'center',
        gap:          36,
        background:   'radial-gradient(ellipse 55% 45% at 50% 50%, #050b14 0%, #000000 100%)',
        willChange:   'transform, opacity',
        transition:   exiting ? 'opacity 0.65s ease, transform 0.65s ease' : 'none',
        opacity:      exiting ? 0 : 1,
        transform:    exiting ? 'scale(1.05)' : 'scale(1)',
        pointerEvents:exiting ? 'none' : 'auto',
        animation:    'ls-fadein 0.3s ease',
        overflow:     'hidden',
      }}
    >
      {/* Subtle scan line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 120,
        background: 'linear-gradient(180deg, rgba(0,240,255,0.04) 0%, transparent 100%)',
        animation: 'ls-scan 5.5s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* ── Orrery ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', width: 180, height: 180,
        animation: 'ls-fadein 0.7s 0.1s ease both',
      }}>

        {/* SVG orbit rings + central star */}
        <svg viewBox="0 0 180 180" width="180" height="180"
          style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <radialGradient id="ls-star-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#fff8cc" />
              <stop offset="55%"  stopColor="#ffb020" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          {/* Halos around star */}
          <circle cx="90" cy="90" r="15" fill="rgba(255,160,20,0.04)" />
          <circle cx="90" cy="90" r="9"  fill="rgba(255,176,32,0.07)" />
          {/* Orbit paths */}
          <circle cx="90" cy="90" r="36" fill="none" stroke="rgba(0,240,255,0.18)"   strokeWidth="0.75" />
          <circle cx="90" cy="90" r="56" fill="none" stroke="rgba(123,97,255,0.13)"  strokeWidth="0.75" />
          <circle cx="90" cy="90" r="77" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.75" />
          {/* Star */}
          <circle cx="90" cy="90" r="4.5" fill="url(#ls-star-grad)" style={{
            transformBox: 'fill-box', transformOrigin: 'center',
            animation: 'ls-pulse 2.3s ease-in-out infinite',
          }} />
        </svg>

        {/* Planet 1 — cyan, inner orbit r=36 */}
        <div style={{
          position: 'absolute', inset: 0, transformOrigin: 'center',
          animation: 'ls-spin-a 5s linear infinite',
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', borderRadius: '50%',
            width: 5, height: 5, background: '#00F0FF',
            boxShadow: '0 0 8px rgba(0,240,255,0.95), 0 0 18px rgba(0,240,255,0.45)',
            transform: 'translate(33px, -2.5px)',
          }} />
        </div>

        {/* Planet 2 — purple, middle orbit r=56 */}
        <div style={{
          position: 'absolute', inset: 0, transformOrigin: 'center',
          animation: 'ls-spin-b 8.5s linear infinite',
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', borderRadius: '50%',
            width: 4, height: 4, background: '#7B61FF',
            boxShadow: '0 0 7px rgba(123,97,255,0.95), 0 0 14px rgba(123,97,255,0.45)',
            transform: 'translate(53px, 2px)',
          }} />
        </div>

        {/* Planet 3 — ice-white, outer orbit r=77 */}
        <div style={{
          position: 'absolute', inset: 0, transformOrigin: 'center',
          animation: 'ls-spin-c 14s linear infinite',
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', borderRadius: '50%',
            width: 3, height: 3, background: 'rgba(200,240,255,0.65)',
            boxShadow: '0 0 5px rgba(200,240,255,0.7)',
            transform: 'translate(74px, -1px)',
          }} />
        </div>
      </div>

      {/* ── Logotype ──────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', animation: 'ls-fadein 0.6s 0.5s ease both' }}>
        <div style={{
          fontFamily:    '"Space Grotesk", sans-serif',
          fontSize:      '1.05rem',
          fontWeight:    600,
          letterSpacing: '0.42em',
          color:         '#ffffff',
          textTransform: 'uppercase',
          textShadow:    '0 0 40px rgba(0,240,255,0.22), 0 0 80px rgba(0,240,255,0.08)',
          animation:     'ls-textin 1s 0.65s cubic-bezier(.22,1,.36,1) both',
        }}>
          ASTRA
          <span style={{ color: 'rgba(0,240,255,0.5)', padding: '0 0.12em' }}>·</span>
          NOVA
        </div>
        <div style={{
          marginTop:     10,
          fontFamily:    '"Space Grotesk", sans-serif',
          fontSize:      '0.36rem',
          letterSpacing: '0.5em',
          color:         'rgba(255,255,255,0.18)',
          textTransform: 'uppercase',
          animation:     'ls-fadein 0.6s 1.1s ease both',
        }}>
          INICIANDO SISTEMAS
        </div>
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <div style={{
        width: 180, height: 1,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 1, overflow: 'hidden',
        animation: 'ls-fadein 0.5s 0.9s ease both',
      }}>
        <div style={{
          height: '100%', borderRadius: 1,
          background: 'linear-gradient(90deg, rgba(0,240,255,0.7) 0%, rgba(123,97,255,0.7) 100%)',
          animation: `ls-bar ${MIN_MS - 200}ms cubic-bezier(.4,0,.8,1) forwards`,
        }} />
      </div>

      {/* Aviso discreto, solo en celular: la experiencia 3D fue pensada para
          disfrutarse mejor con más pantalla e interacción por mouse — pero
          no queremos que se sienta como una advertencia grande ni un cartel
          de "usá otra cosa". Va chiquito, apagado y al final de todo, como
          un dato al pasar mientras carga, no como algo que compite por
          atención con el logo o la barra de progreso. `md:hidden` lo oculta
          por completo en tablet/escritorio (breakpoint 768px, igual que
          IS_MOBILE en el resto del sitio). */}
      <div className="md:hidden" style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: '0.5rem',
        letterSpacing: '0.03em',
        color: 'rgba(255,255,255,0.22)',
        textAlign: 'center',
        maxWidth: 230,
        lineHeight: 1.5,
        padding: '0 20px',
        animation: 'ls-fadein 0.8s 1.15s ease both',
      }}>
        Para sentir aún más la inmersión, probá Astra Nova desde una computadora.
      </div>
    </div>
  )
}
