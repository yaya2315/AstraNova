'use client'

import { motion } from 'framer-motion'

// Logo animado compartido entre SideNav (desktop) y TopNav (móvil, donde además
// funciona como botón para abrir el menú — ver page.tsx).
// `size` escala todo el sistema manteniendo las proporciones originales (48px base).
export default function MiniSolarSystem({ size = 48, active = false }: { size?: number; active?: boolean }) {
  const scale = size / 48
  return (
    <div className="relative" style={{ width: 48, height: 48, transform: `scale(${scale})` }}>
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Orbit rings — se iluminan un poco cuando el logo hace de botón activo */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 24, height: 24, borderWidth: 1, borderStyle: 'solid' }}
          animate={{ borderColor: active ? 'rgba(0,240,255,0.45)' : 'rgba(0,240,255,0.14)' }}
          transition={{ duration: 0.3 }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ width: 38, height: 38, borderWidth: 1, borderStyle: 'solid' }}
          animate={{ borderColor: active ? 'rgba(123,97,255,0.35)' : 'rgba(123,97,255,0.10)' }}
          transition={{ duration: 0.3 }}
        />
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
