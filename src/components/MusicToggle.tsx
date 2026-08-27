'use client'

// Botón flotante de música ambiental — mismo lenguaje visual que el botón
// "↑ Volver" de DeepNavHUD (vidrio oscuro + acento cian), pero en la esquina
// inferior derecha, que en todo el sitio queda libre (ver page.tsx: SideNav
// ocupa la izquierda, TopNav/DeepNavHUD la parte de arriba, DivePortal el
// centro-abajo).
import { useEffect, useState } from 'react'
import { alternarMusica, suscribirseMusica } from '@/lib/musicaAmbiente'

export default function MusicToggle() {
  const [sonando, setSonando] = useState(false)

  useEffect(() => suscribirseMusica(setSonando), [])

  return (
    <button
      onClick={() => { alternarMusica() }}
      aria-label={sonando ? 'Silenciar música ambiental' : 'Reproducir música ambiental'}
      aria-pressed={sonando}
      className="fixed bottom-5 right-4 lg:right-5 z-[900] flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300"
      style={{
        color: sonando ? 'rgba(0,240,255,0.9)' : 'rgba(0,240,255,0.45)',
        border: `1px solid ${sonando ? 'rgba(0,240,255,0.40)' : 'rgba(0,240,255,0.15)'}`,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.color = 'rgba(0,240,255,0.9)'
        el.style.borderColor = 'rgba(0,240,255,0.40)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.color = sonando ? 'rgba(0,240,255,0.9)' : 'rgba(0,240,255,0.45)'
        el.style.borderColor = sonando ? 'rgba(0,240,255,0.40)' : 'rgba(0,240,255,0.15)'
      }}
    >
      {sonando ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="16.5" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
          <circle cx="6.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
          <circle cx="16.5" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
          <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}
