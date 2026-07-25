'use client'

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import LoadingScreen from '@/components/LoadingScreen'
import { DeepNavProvider, useDeepNav, LAYERS } from '@/components/DeepNavEngine'
import PremiumSpaceExperience from '@/components/PremiumSpaceExperience'
import SideNav from '@/components/SideNav'
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
// Los botones llaman a jumpTo() igual que el SideNav.
function TopNav() {
  const { depth, jumpTo } = useDeepNav()

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-[998] lg:hidden flex items-center justify-between gap-2 px-2 sm:px-4"
      style={{
        height: '54px',
        background: 'rgba(4, 6, 14, 0.88)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* Logo — punto pulsante como el SideNav, para que no se sienta tan desnudo */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="relative flex-shrink-0" style={{ width: 6, height: 6 }}>
          <span className="absolute inset-0 rounded-full animate-pulse-glow" style={{ background: '#00F0FF' }} />
        </span>
        <div className="font-display flex flex-col leading-none select-none" style={{ letterSpacing: '2.2px' }}>
          <span style={{ fontSize: '0.62rem', color: '#00F0FF', fontWeight: 700 }}>ASTRA</span>
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.30)', marginTop: '2px' }}>NOVA</span>
        </div>
      </div>

      {/* Botones de sección — ícono + etiqueta, con un halo activo que se desliza
          entre botones (layoutId compartido). Se encogen y, si no entran, la fila
          se desliza horizontalmente en vez de salirse de pantalla. */}
      <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map(item => {
          const isActive = depth === item.layerIndex
          return (
            <button
              key={item.layerIndex}
              onClick={() => jumpTo(item.layerIndex)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full transition-colors duration-200 border-0 cursor-pointer font-display flex-shrink-0 ${
                isActive ? 'text-accent-cyan' : 'text-white/40 hover:text-white/75'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="topNavActivePill"
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: 'rgba(0,240,255,0.09)',
                    border: '1px solid rgba(0,240,255,0.26)',
                    boxShadow: '0 0 14px rgba(0,240,255,0.16), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-[1] flex-shrink-0 [&>svg]:w-[13px] [&>svg]:h-[13px]">
                {item.icon}
              </span>
              <span className="relative z-[1] whitespace-nowrap" style={{ fontSize: '8.5px', letterSpacing: '1px' }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Bottom glow line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(0,240,255,0.18) 50%, transparent 95%)' }}
      />
    </motion.nav>
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
          <div className="max-w-[1320px] mx-auto px-6">
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
          <div className="max-w-[1400px] mx-auto px-4">
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
    </DeepNavProvider>
    </>
  )
}
