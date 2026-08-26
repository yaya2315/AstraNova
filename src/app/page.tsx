'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingScreen from '@/components/LoadingScreen'
import { DeepNavProvider, useDeepNav, LAYERS } from '@/components/DeepNavEngine'
import PremiumSpaceExperience from '@/components/PremiumSpaceExperience'
import CockpitFrame from '@/components/CockpitFrame'
import SideNav from '@/components/SideNav'
import MiniSolarSystem from '@/components/MiniSolarSystem'
import { NAV_ITEMS } from '@/lib/navItems'
import {
  HeroSection,
  HistorySection,
  ConstellationsSection,
  GallerySection,
  MissionsSection,
  Footer,
} from '@/components/Sections'

const SolarSystem = dynamic(() => import('@/components/SolarSystem'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[440px] sm:h-[560px] md:h-[680px] lg:h-[800px] rounded-2xl overflow-hidden flex items-center justify-center bg-space-800/30">
      <div className="font-display text-sm tracking-[4px] text-slate-500 animate-pulse">
        CARGANDO SISTEMA SOLAR...
      </div>
    </div>
  ),
})

// ── Barra de navegación superior (visible en viewports < lg) ─────────────────
// Complementa el SideNav que solo aparece en desktop (hidden lg:flex).
// En vez de un hamburger genérico, el propio logo animado (mini sistema solar)
// es el botón que abre el panel de secciones — único de este sitio.
function TopNav() {
  const { depth, jumpTo } = useDeepNav()
  const [open, setOpen] = useState(false)
  const activeItem = NAV_ITEMS.find(i => i.layerIndex === depth)

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-[998] lg:hidden flex items-center justify-between gap-2 px-4"
        style={{
          height: '54px',
          background: 'rgba(4, 6, 14, 0.88)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo animado = botón de menú. El anillo se enciende y la flecha gira
            cuando el panel está abierto, para que quede claro que es tocable. */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          className="flex items-center gap-1.5 flex-shrink-0 border-0 bg-transparent cursor-pointer py-1 -my-1 pr-1"
        >
          <MiniSolarSystem size={34} active={open} />
          <div className="font-display flex flex-col leading-none select-none" style={{ letterSpacing: '2.2px' }}>
            <span style={{ fontSize: '0.62rem', color: '#00F0FF', fontWeight: 700 }}>ASTRA</span>
            <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.30)', marginTop: '2px' }}>NOVA</span>
          </div>
          <motion.svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="ml-0.5 flex-shrink-0"
            style={{ color: open ? '#00F0FF' : 'rgba(255,255,255,0.35)' }}
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <path d="M6 9l6 6 6-6" />
          </motion.svg>
        </button>

        {/* Sección activa — reemplaza a la fila de botones que no entraba en pantallas angostas */}
        {activeItem && (
          <div className="flex items-center gap-1.5 text-accent-cyan flex-shrink min-w-0">
            <span className="flex-shrink-0 [&>svg]:w-[13px] [&>svg]:h-[13px]">{activeItem.icon}</span>
            <span className="font-display truncate" style={{ fontSize: '9px', letterSpacing: '1.4px' }}>{activeItem.label}</span>
          </div>
        )}

        {/* Bottom glow line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(0,240,255,0.18) 50%, transparent 95%)' }}
        />
      </motion.nav>

      {/* Panel desplegable de secciones */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[997] lg:hidden"
              style={{ background: 'rgba(0,0,4,0.55)', backdropFilter: 'blur(2px)' }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-3 right-3 z-[998] lg:hidden rounded-2xl overflow-hidden"
              style={{
                top: '62px',
                background: 'rgba(6, 9, 18, 0.92)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: '1px solid rgba(0,240,255,0.14)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 40px rgba(0,240,255,0.06)',
              }}
            >
              {NAV_ITEMS.map((item, i) => {
                const isActive = depth === item.layerIndex
                return (
                  <motion.button
                    key={item.layerIndex}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                    onClick={() => { jumpTo(item.layerIndex); setOpen(false) }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative w-full flex items-center gap-3 px-5 py-3.5 border-0 cursor-pointer font-display transition-colors ${
                      isActive ? 'text-accent-cyan bg-accent-cyan/[0.07]' : 'text-white/55 hover:text-white hover:bg-white/[0.03]'
                    }`}
                    style={{ borderBottom: i < NAV_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: '#00F0FF', boxShadow: '0 0 8px rgba(0,240,255,0.9)' }} />
                    )}
                    <span className="flex-shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px]">{item.icon}</span>
                    <span style={{ fontSize: '0.75rem', letterSpacing: '2px' }}>{item.label}</span>
                  </motion.button>
                )
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// ── HUD de profundidad ────────────────────────────────────────────────────────
// Indicador fijo: puntos de profundidad + botón ↑ Volver.
// Solo aparece cuando depth > 0 (invisible en la superficie).
// Z-index 500: sobre las capas (z-10) pero bajo SideNav (z-999).
function DeepNavHUD() {
  const { depth, surface } = useDeepNav()

  return (
    <div
      className="fixed top-[62px] right-4 lg:top-5 lg:right-5 z-[500] flex items-center gap-3"
      style={{
        opacity:       depth > 0 ? 1 : 0,
        pointerEvents: depth > 0 ? 'auto' : 'none',
        transition:    'opacity 0.3s ease',
      }}
    >
      {/* Puntos de profundidad: uno por capa registrada */}
      <div className="flex items-center gap-[5px]" aria-hidden="true">
        {LAYERS.map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all duration-400"
            style={{
              width:      i === depth ? '6px' : '4px',
              height:     i === depth ? '6px' : '4px',
              background: i === depth
                ? '#00F0FF'
                : i < depth
                  ? 'rgba(0,240,255,0.28)'
                  : 'rgba(255,255,255,0.10)',
            }}
          />
        ))}
      </div>

      {/* Botón ↑ Volver — subtil, se activa con hover */}
      <button
        onClick={surface}
        aria-label="Volver (Escape / Backspace)"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300"
        style={{
          fontFamily:     'inherit',
          fontSize:       '0.52rem',
          letterSpacing:  '0.18em',
          textTransform:  'uppercase',
          color:          'rgba(0,240,255,0.45)',
          border:         '1px solid rgba(0,240,255,0.15)',
          background:     'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(12px)',
          cursor:         'pointer',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.color = 'rgba(0,240,255,0.9)'
          el.style.borderColor = 'rgba(0,240,255,0.40)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.color = 'rgba(0,240,255,0.45)'
          el.style.borderColor = 'rgba(0,240,255,0.15)'
        }}
      >
        ↑ Volver
      </button>
    </div>
  )
}

// ── Affordance de inmersión ───────────────────────────────────────────────────
// Disparador de dive() fijo en la parte inferior de la pantalla.
// Position:fixed — fuera del stack transformado, por eso funciona correctamente.
// Solo visible cuando la capa actual tiene una siguiente a la que ir.
function DivePortal() {
  const { depth, dive } = useDeepNav()
  const hasNext = depth < LAYERS.length - 1
  const labels = [
    'Sistema Solar',
    'Historia Cósmica',
    'Constelaciones',
    'Galería',
    'Misiones',
    'Contacto',
  ]
  const label = labels[depth] ?? ''

  return (
    <button
      onClick={() => { if (hasNext) dive(depth + 1) }}
      aria-label={`Explorar: ${label}`}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2
                 bg-transparent border-0 cursor-pointer group focus:outline-none
                 transition-opacity duration-500"
      style={{
        opacity:        hasNext ? 1 : 0,
        pointerEvents:  hasNext ? 'auto' : 'none',
      }}
    >
      <span
        className="font-display uppercase transition-opacity duration-300 group-hover:opacity-60"
        style={{
          fontSize:      '0.38rem',
          letterSpacing: '0.32em',
          color:         'rgba(255,255,255,0.15)',
        }}
      >
        {label}
      </span>
      {/* Línea pulsante — la misma que el scroll indicator del Hero */}
      <div
        className="w-px h-10 transition-opacity duration-300 group-hover:opacity-70"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,240,255,0.28), transparent)',
          opacity: 0.35,
          animation: 'scrollPulse 2s ease-in-out infinite',
        }}
      />
    </button>
  )
}

// ── Stack de capas ────────────────────────────────────────────────────────────
// Todas las capas comparten position:absolute inset:0 — ocupan el mismo punto.
// El JS (DeepNavEngine) escribe data-state; el CSS aplica scale + opacity.
//
// PARA AGREGAR UNA CAPA:
//   1. Añadir su id a LAYERS en DeepNavEngine.tsx
//   2. Añadir un <div id="layer-N" className="deep-layer"> aquí
//   3. Añadir su label al array `labels` en DivePortal (arriba)
function LayerStack() {
  return (
    <div id="deep-stack">

      {/* ── Capa 0 — Hub / Hero ─────────────────────────────────────────── */}
      <div id="layer-0" className="deep-layer" aria-label="Inicio">
        <HeroSection />
      </div>

      {/* ── Capa 1 — Sistema Solar ──────────────────────────────────────── */}
      <div id="layer-1" className="deep-layer" aria-label="Sistema Solar">
        <section id="sistema-solar" className="relative z-[1] py-20">
          <div className="max-w-[1320px] mx-auto px-6 sm:px-8 md:px-12">
            <div className="text-center">
              <div className="section-label">EXPLORACIÓN INTERACTIVA</div>
            </div>
            <h2 className="font-serif text-[clamp(2.8rem,6vw,5rem)] text-center mb-4 text-white/80 font-normal italic">
              Sistema Solar
            </h2>
            <p className="text-center text-slate-400 text-lg max-w-[650px] mx-auto mb-12 leading-relaxed">
              Ocho mundos extraordinarios orbitando nuestra estrella. Arrastra para rotar,
              pasa el cursor sobre cualquier planeta para descubrir sus secretos.
            </p>
          </div>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-10">
            <SolarSystem />
          </div>
        </section>
      </div>

      {/* ── Capa 2 — Historia Cósmica ───────────────────────────────────── */}
      <div id="layer-2" className="deep-layer" aria-label="Historia Cósmica">
        <HistorySection />
      </div>

      {/* ── Capa 3 — Constelaciones ─────────────────────────────────────── */}
      <div id="layer-3" className="deep-layer" aria-label="Constelaciones">
        <ConstellationsSection />
      </div>

      {/* ── Capa 4 — Galería ────────────────────────────────────────────── */}
      <div id="layer-4" className="deep-layer" aria-label="Galería Cósmica">
        <GallerySection />
      </div>

      {/* ── Capa 5 — Misiones ───────────────────────────────────────────── */}
      <div id="layer-5" className="deep-layer" aria-label="Misiones Activas">
        <MissionsSection />
      </div>

      {/* ── Capa 6 — Footer / Contacto ──────────────────────────────────── */}
      {/* Última capa: no tiene DivePortal (es el fondo del stack) */}
      <div id="layer-6" className="deep-layer" aria-label="Contacto">
        <Footer />
      </div>

    </div>
  )
}

// ── Raíz ──────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <>
    <LoadingScreen />
    <DeepNavProvider>
      {/* PIEZA 1: Fondo persistente — nunca se desmonta ni sale del DOM */}
      <PremiumSpaceExperience />

      {/* PIEZA 2: UI fija — siempre visible sobre todas las capas */}
      <TopNav />
      <SideNav />
      <DeepNavHUD />
      <DivePortal />

      {/* PIEZA 3: Stack de capas — todas en el mismo punto del espacio */}
      <LayerStack />

      {/* PIEZA 4: Marco de la cubierta de observación — decorativo, por encima
          del stack, por debajo del HUD fijo */}
      <CockpitFrame />
    </DeepNavProvider>
    </>
  )
}
