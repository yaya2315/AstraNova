'use client'

import { motion } from 'framer-motion'
import { useDeepNav } from '@/components/DeepNavEngine'
import { NAV_ITEMS } from '@/lib/navItems'
import MiniSolarSystem from '@/components/MiniSolarSystem'

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
      {NAV_ITEMS.map(item => {
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
            {/* Indicador de profundidad — un solo elemento compartido (layoutId) que
                se desliza/mofa entre ítems al cambiar de capa, en vez de dos pills
                estáticos cruzando opacidad. Framer Motion anima la transición de
                posición automáticamente cuando el layoutId "salta" de botón. */}
            {isActive && (
              <motion.span
                layoutId="depth-indicator-pill"
                className="absolute inset-x-2 inset-y-1 rounded-xl pointer-events-none"
                style={{
                  background: 'rgba(0,240,255,0.07)',
                  border:     '1px solid rgba(0,240,255,0.16)',
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              />
            )}
            {isActive && (
              <motion.span
                layoutId="depth-indicator-pip"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r-full pointer-events-none"
                style={{
                  background: '#00F0FF',
                  boxShadow:  '0 0 8px rgba(0,240,255,0.9), 0 0 16px rgba(0,240,255,0.4)',
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              />
            )}

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
