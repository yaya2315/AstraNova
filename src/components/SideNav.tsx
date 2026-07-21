'use client'

import { motion } from 'framer-motion'
import { useDeepNav } from '@/components/DeepNavEngine'

function MiniSolarSystem() {
  return (
    <div className="relative" style={{ width: 48, height: 48 }}>
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Orbit rings */}
        <div className="absolute rounded-full" style={{ width: 24, height: 24, border: '1px solid rgba(0,240,255,0.14)' }} />
        <div className="absolute rounded-full" style={{ width: 38, height: 38, border: '1px solid rgba(123,97,255,0.10)' }} />
        {/* Sun */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'radial-gradient(circle, #fff8cc 0%, #ffb020 55%, transparent 100%)',
          boxShadow: '0 0 6px rgba(255,176,32,0.95), 0 0 14px rgba(255,176,32,0.35)',
        }} />
      </div>

      {/* Inner planet — cyan */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 4, height: 4, borderRadius: '50%',
          background: '#00F0FF',
          boxShadow: '0 0 5px rgba(0,240,255,0.95)',
          transform: 'translate(8px, -2px)',
        }} />
      </motion.div>

      {/* Outer planet — purple */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'linear' }}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 3, height: 3, borderRadius: '50%',
          background: '#7B61FF',
          boxShadow: '0 0 4px rgba(123,97,255,0.95)',
          transform: 'translate(15px, -1.5px)',
        }} />
      </motion.div>

      {/* Third planet — teal, slow outer-outer orbit */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 2.5, height: 2.5, borderRadius: '50%',
          background: 'rgba(0,240,255,0.55)',
          transform: 'translate(17px, 3px)',
        }} />
      </motion.div>
    </div>
  )
}

// Cada item mapea directamente a un índice de capa del motor de profundidad.
// Para agregar un item: añadir entrada aquí y registrar la capa en DeepNavEngine.tsx.
const items = [
  {
    layerIndex: 0,
    label: 'INICIO',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    layerIndex: 1,
    label: 'SISTEMA',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <ellipse cx="12" cy="12" rx="10" ry="3.5" />
      </svg>
    ),
  },
  {
    layerIndex: 2,
    label: 'HISTORIA',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="12" x2="13" y2="12" />
      </svg>
    ),
  },
  {
    layerIndex: 3,
    label: 'CONSTELAC.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <circle cx="5"  cy="5"  r="1.8" fill="currentColor" stroke="none" />
        <circle cx="19" cy="7"  r="1.8" fill="currentColor" stroke="none" />
        <circle cx="10" cy="17" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="18" cy="19" r="1.8" fill="currentColor" stroke="none" />
        <line x1="5"  y1="5"  x2="19" y2="7"  strokeWidth="0.8" />
        <line x1="19" y1="7"  x2="10" y2="17" strokeWidth="0.8" />
        <line x1="10" y1="17" x2="18" y2="19" strokeWidth="0.8" />
      </svg>
    ),
  },
  {
    layerIndex: 4,
    label: 'GALERÍA',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    layerIndex: 5,
    label: 'MISIONES',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2s-4 4-4 9c0 2.2 4 7 4 7s4-4.8 4-7c0-5-4-9-4-9z" />
        <path d="M8 11c-1.5 0-3 .6-4 2l1 3.5 3.5-1" />
        <path d="M16 11c1.5 0 3 .6 4 2l-1 3.5-3.5-1" />
        <circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
]

export default function SideNav() {
  // Reemplaza el tracking por scroll con el estado de profundidad del motor.
  // jumpTo() permite saltar directamente a cualquier capa (sin restricción secuencial).
  const { depth, jumpTo } = useDeepNav()

  return (
    <motion.nav
      initial={{ opacity: 0, x: -32, filter: 'blur(12px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.9, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed left-4 top-[22%] -translate-y-1/2 z-[999] hidden lg:flex flex-col"
      style={{
        width: '72px',
        borderRadius: '20px',
        background: 'rgba(4, 6, 14, 0.78)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
        padding: '0',
      }}
    >
      {/* Top glow line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-px rounded-full"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,240,255,0.55), transparent)' }}
      />

      {/* Logo block */}
      <div className="flex flex-col items-center pt-4 pb-3 px-1">
        <MiniSolarSystem />
        <div className="font-display text-center leading-none mt-1" style={{ letterSpacing: '1.8px' }}>
          <div style={{ fontSize: '0.44rem', color: '#00F0FF', fontWeight: 700 }}>ASTRA</div>
          <div style={{ fontSize: '0.44rem', color: 'rgba(255,255,255,0.32)', marginTop: '2px' }}>NOVA</div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px mb-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />

      {/* Nav items — onClick llama jumpTo() en lugar de seguir un href */}
      {items.map(item => {
        const isActive = depth === item.layerIndex
        return (
          <button
            key={item.layerIndex}
            onClick={() => jumpTo(item.layerIndex)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex flex-col items-center justify-center gap-[5px] py-3 transition-all duration-300 group border-0 bg-transparent cursor-pointer w-full"
            style={{ color: isActive ? '#00F0FF' : 'rgba(255,255,255,0.28)' }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)'
            }}
          >
            {/* Active background pill — siempre en el DOM, opacity evita mount/unmount durante transiciones */}
            <span
              className="absolute inset-x-2 inset-y-1 rounded-xl pointer-events-none"
              style={{
                opacity:    isActive ? 1 : 0,
                transition: 'opacity 0.25s ease',
                background: 'rgba(0,240,255,0.07)',
                border:     '1px solid rgba(0,240,255,0.16)',
              }}
            />

            {/* Left glow pip */}
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r-full pointer-events-none"
              style={{
                opacity:    isActive ? 1 : 0,
                transition: 'opacity 0.25s ease',
                background: '#00F0FF',
                boxShadow:  '0 0 8px rgba(0,240,255,0.9), 0 0 16px rgba(0,240,255,0.4)',
              }}
            />

            <span className="relative z-[1]">{item.icon}</span>
            <span
              className="relative z-[1] font-display leading-none text-center"
              style={{ fontSize: '0.30rem', letterSpacing: '1.4px' }}
            >
              {item.label}
            </span>
          </button>
        )
      })}

      {/* Bottom glow line */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-px rounded-full mb-0"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,240,255,0.2), transparent)' }}
      />
    </motion.nav>
  )
}
