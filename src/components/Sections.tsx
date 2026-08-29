'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, useInView, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { chapters, constellations, missions, galleryImages, type ConstellationData } from '@/lib/data'
import { useDeepNav } from '@/components/DeepNavEngine'
import { abrirMisionDelMotor } from '@/lib/motorMisionesBridge'

// ─── Animation ───────────────────────────────────────────────────────────────

// Mismo patrón que en SolarSystem.tsx/SystemFlyby.tsx: se calcula una sola vez
// al cargar el módulo, para bajar densidad de estrellas y limitar el framerate
// de los canvas 2D (Constelaciones) en celular sin tocar desktop.
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768

const EASE = [0.22, 1, 0.36, 1] as const

// Fade + blur up — bidirectional (animates out when leaving viewport)
function FadeUp({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, margin: '-80px 0px -60px 0px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 44 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 44 }}
      transition={{ duration: 0.9, delay: inView ? delay : 0, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

// Slide in from left or right — bidirectional
function SlideIn({ children, className = '', delay = 0, from = 'left' }: { children: React.ReactNode; className?: string; delay?: number; from?: 'left' | 'right' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, margin: '-80px 0px -60px 0px' })
  const x = from === 'left' ? -70 : 70
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, x }}
      animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x }}
      transition={{ duration: 0.9, delay: inView ? delay : 0, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

// Scale + fade entrance for cards — bidirectional
function ScaleIn({ children, className = '', delay = 0, style }: { children: React.ReactNode; className?: string; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, margin: '-60px 0px -40px 0px' })
  return (
    <motion.div ref={ref} className={className} style={style}
      initial={{ opacity: 0, scale: 0.90, y: 24 }}
      animate={inView ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.90, y: 24 }}
      transition={{ duration: 0.75, delay: inView ? delay : 0, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

// Magnetic button pull effect
function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    el.style.transform = `translate(${(e.clientX-r.left-r.width/2)*.26}px,${(e.clientY-r.top-r.height/2)*.26}px)`
    el.style.transition = 'transform 0.08s linear'
  }
  const onLeave = () => {
    const el = ref.current; if (!el) return
    el.style.transform = 'translate(0,0)'
    el.style.transition = 'transform 0.55s cubic-bezier(0.23,1,0.32,1)'
  }
  return <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}>{children}</div>
}

// Floating zone label
function ZoneLabel({ text }: { text: string }) {
  return (
    <div className="section-label justify-center">
      {text}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUZZLE GAME (unchanged logic)
═══════════════════════════════════════════════════════════════════════════ */
function PuzzleGame({ puzzle, onClose }: { puzzle: any; onClose: () => void }) {
  const { setOverlayOpen } = useDeepNav()
  useEffect(() => {
    setOverlayOpen(true)
    return () => setOverlayOpen(false)
  }, [setOverlayOpen])

  const [result, setResult] = useState<'none' | 'correct' | 'wrong'>('none')
  const [order, setOrder] = useState<string[]>([])
  const [remaining, setRemaining] = useState<string[]>(() =>
    puzzle.type === 'order' ? [...puzzle.items].sort(() => Math.random() - 0.5) : [])
  const [quizPick, setQuizPick] = useState<number | null>(null)
  const [tfAnswers, setTfAnswers] = useState<(boolean | null)[]>(() =>
    puzzle.type === 'truefalse' ? puzzle.statements.map(() => null) : [])
  const [matchLeft, setMatchLeft] = useState<number | null>(null)
  const [matched, setMatched] = useState<Map<number, number>>(new Map())
  const [shuffledRight] = useState<number[]>(() =>
    puzzle.type === 'match' ? [...Array(puzzle.pairs.length).keys()].sort(() => Math.random() - 0.5) : [])

  const reset = () => {
    setResult('none'); setOrder([]); setQuizPick(null); setMatchLeft(null); setMatched(new Map())
    setTfAnswers(puzzle.type === 'truefalse' ? puzzle.statements.map(() => null) : [])
    if (puzzle.type === 'order') setRemaining([...puzzle.items].sort(() => Math.random() - 0.5))
  }
  const check = () => {
    if (puzzle.type === 'order') setResult(puzzle.items.every((it: string, i: number) => order[i] === it) ? 'correct' : 'wrong')
    else if (puzzle.type === 'quiz') setResult(quizPick === puzzle.answer ? 'correct' : 'wrong')
    else if (puzzle.type === 'truefalse') setResult(puzzle.statements.every((s: any, i: number) => tfAnswers[i] === s.answer) ? 'correct' : 'wrong')
    else if (puzzle.type === 'match') setResult([...matched.entries()].every(([l, r]) => l === r) && matched.size === puzzle.pairs.length ? 'correct' : 'wrong')
  }
  const canCheck =
    (puzzle.type === 'order' && order.length === puzzle.items.length) ||
    (puzzle.type === 'quiz' && quizPick !== null) ||
    (puzzle.type === 'truefalse' && tfAnswers.every((a: boolean | null) => a !== null)) ||
    (puzzle.type === 'match' && matched.size === puzzle.pairs.length)
  const typeLabel = puzzle.type === 'order' ? 'ORDENAR' : puzzle.type === 'quiz' ? 'PREGUNTA' : puzzle.type === 'truefalse' ? 'V / F' : 'CONECTAR'

  // Portal a document.body: las secciones viven dentro de un `.deep-layer` de
  // DeepNavEngine, que siempre tiene `transform` aplicado (incluso scale(1) en
  // la capa activa) — eso convierte a un `position: fixed` descendiente en algo
  // "fijo respecto a esa capa" en vez de la ventana real. Mismo fix que ya usa
  // SystemFlybyView para su overlay a pantalla completa.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="card-glass-static p-5 sm:p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-[0.55rem] tracking-[3px] text-accent-gold">PUZZLE</span>
            <span className="px-2 py-0.5 rounded-full border border-accent-cyan/15 text-accent-cyan text-[0.5rem] font-display tracking-[2px]">{typeLabel}</span>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-white text-xs transition-colors">✕</button>
        </div>
        <p className="text-slate-300 text-sm mb-4">{puzzle.question}</p>

        {puzzle.type === 'order' && (
          <>
            <div className="min-h-[44px] border border-dashed border-accent-purple/20 rounded-lg p-3 mb-3 flex flex-wrap gap-2">
              {order.length === 0 && <span className="text-slate-400 text-xs">Selecciona en orden...</span>}
              {order.map((item, i) => (
                <button key={item} onClick={() => { setRemaining(p => [...p, item]); setOrder(p => p.filter(x => x !== item)); setResult('none') }}
                  className="px-3 py-1.5 rounded-lg bg-accent-purple/15 text-accent-purple text-xs font-display tracking-wider flex items-center gap-1.5 hover:bg-accent-purple/25 transition-colors">
                  <span className="text-[0.55rem] text-slate-600">{i+1}.</span>{item}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {remaining.map(item => (
                <button key={item} onClick={() => { setOrder(p => [...p, item]); setRemaining(p => p.filter(x => x !== item)); setResult('none') }}
                  className="px-3 py-1.5 rounded-lg border border-white/8 text-slate-400 text-xs font-display tracking-wider hover:border-accent-purple/35 hover:text-white transition-all">
                  {item}
                </button>
              ))}
            </div>
          </>
        )}
        {puzzle.type === 'quiz' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
            {puzzle.options.map((opt: string, i: number) => (
              <button key={i} onClick={() => { setQuizPick(i); setResult('none') }}
                className={`px-4 py-2.5 rounded-xl border text-left text-sm font-display tracking-wider transition-all ${
                  quizPick === i ? (result === 'correct' ? 'border-accent-emerald/60 bg-accent-emerald/10 text-accent-emerald' : result === 'wrong' ? 'border-accent-rose/60 bg-accent-rose/10 text-accent-rose' : 'border-accent-purple/50 bg-accent-purple/10 text-accent-purple')
                  : 'border-white/8 text-slate-400 hover:border-accent-purple/25 hover:text-white'}`}>
                <span className="text-slate-600 mr-2">{String.fromCharCode(65+i)}.</span>{opt}
              </button>
            ))}
          </div>
        )}
        {puzzle.type === 'truefalse' && (
          <div className="space-y-2.5 mb-4">
            {puzzle.statements.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/5">
                <p className="flex-1 text-slate-300 text-sm">{s.text}</p>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { const n=[...tfAnswers]; n[i]=true; setTfAnswers(n); setResult('none') }}
                    className={`px-2.5 py-1 rounded-lg text-[0.6rem] font-display tracking-wider transition-all ${tfAnswers[i]===true?'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/35':'border border-white/8 text-slate-400 hover:text-white'}`}>V</button>
                  <button onClick={() => { const n=[...tfAnswers]; n[i]=false; setTfAnswers(n); setResult('none') }}
                    className={`px-2.5 py-1 rounded-lg text-[0.6rem] font-display tracking-wider transition-all ${tfAnswers[i]===false?'bg-accent-rose/15 text-accent-rose border border-accent-rose/35':'border border-white/8 text-slate-400 hover:text-white'}`}>F</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {puzzle.type === 'match' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="space-y-2">
              {puzzle.pairs.map((p: string[], i: number) => {
                const isM = matched.has(i)
                return (
                  <button key={i} onClick={() => { if (!isM) setMatchLeft(matchLeft===i?null:i) }}
                    className={`w-full px-4 py-2.5 rounded-xl text-left text-sm font-display tracking-wider transition-all ${isM?'border border-accent-emerald/30 text-accent-emerald/70':matchLeft===i?'border border-accent-purple/50 bg-accent-purple/12 text-accent-purple':'border border-white/8 text-slate-400 hover:text-white'}`}>
                    {p[0]}
                  </button>
                )
              })}
            </div>
            <div className="space-y-2">
              {shuffledRight.map(ri => {
                const isM = [...matched.values()].includes(ri)
                return (
                  <button key={ri} onClick={() => { if (matchLeft!==null&&!isM){const n=new Map(matched);n.set(matchLeft,ri);setMatched(n);setMatchLeft(null);setResult('none')} }}
                    className={`w-full px-4 py-2.5 rounded-xl text-left text-sm font-display tracking-wider transition-all ${isM?'border border-accent-emerald/30 text-accent-emerald/70':'border border-white/8 text-slate-400 hover:text-white'}`}>
                    {puzzle.pairs[ri][1]}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={check} disabled={!canCheck}
            className="px-5 py-2 rounded-lg bg-accent-cyan/12 text-accent-cyan text-xs font-display tracking-[2px] hover:bg-accent-cyan/22 transition-colors disabled:opacity-25 disabled:cursor-not-allowed">
            VERIFICAR
          </button>
          <button onClick={reset}
            className="px-5 py-2 rounded-lg border border-white/8 text-slate-400 text-xs font-display tracking-[2px] hover:text-white transition-colors">
            RESET
          </button>
          <AnimatePresence mode="wait">
            {result === 'correct' && <motion.span key="ok" initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} exit={{opacity:0}} className="text-accent-emerald text-xs font-display tracking-wider">✓ Correcto</motion.span>}
            {result === 'wrong'   && <motion.span key="no" initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} exit={{opacity:0}} className="text-accent-rose   text-xs font-display tracking-wider">Inténtalo de nuevo</motion.span>}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO — Floating in the cosmos
═══════════════════════════════════════════════════════════════════════════ */
export function HeroSection() {
  const [heroReady, setHeroReady] = useState(false)
  const { jumpTo } = useDeepNav()

  useEffect(() => { setHeroReady(true) }, [])

  const sectionRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })
  const contentY  = useTransform(scrollYProgress, [0, 1], [0, -80])
  const contentOp = useTransform(scrollYProgress, [0, 0.55], [1, 0])

  return (
    <section ref={sectionRef} id="inicio" className="min-h-screen flex items-center relative z-[1] overflow-hidden">

      {/* Parallax wrapper — stacks text + stats vertically, centered on screen */}
      <motion.div
        style={{ y: contentY, opacity: contentOp }}
        className="w-full flex flex-col gap-10 relative z-[1]"
      >
        <div className="max-w-[1440px] mx-auto w-full px-6 sm:px-8 md:px-12 lg:pl-[136px]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={heroReady ? { opacity: 1 } : {}}
            transition={{ duration: 1.2, delay: 0.2 }}
            className="w-full"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
              animate={heroReady ? { opacity: 1, x: 0, filter: 'blur(0px)' } : {}}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="inline-flex items-center gap-3 px-4 py-2 border rounded-full font-display text-[0.5rem] tracking-[3px] mb-7 backdrop-blur-sm"
              style={{ borderColor: 'rgba(0,240,255,0.15)', color: 'rgba(0,240,255,0.55)', background: 'rgba(0,240,255,0.03)' }}
            >
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>SYS-ASTRA-001</span>
              <span style={{ color: 'rgba(0,240,255,0.2)' }}>•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-green-400/80 shadow-[0_0_6px_#4ade80] animate-pulse" />
                EN VIVO
              </span>
            </motion.div>

            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={heroReady ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.55 }}
              className="font-display text-[0.62rem] tracking-[6px] mb-4"
              style={{ color: 'rgba(0,240,255,0.45)' }}
            >
              EXPLORACIÓN INFINITA
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 36 }}
              animate={heroReady ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 1.3, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-black leading-[0.87] mb-7"
            >
              <span className="block text-[clamp(3.4rem,8vw,6.8rem)]" style={{ color: '#FFFFFF' }}>
                EXPLORA
              </span>
              <span className="block text-[clamp(3.4rem,8vw,6.8rem)]">
                <span
                  style={{
                    background: 'linear-gradient(135deg, #00FFCB 0%, #00F0FF 50%, #7B61FF 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  SIN LÍMITES
                </span>
              </span>
            </motion.h1>

            {/* Energy separator */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={heroReady ? { scaleX: 1, opacity: 1 } : {}}
              transition={{ duration: 1.4, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
              className="origin-left h-px w-40 mb-7"
              style={{ background: 'linear-gradient(90deg, #00F0FF, #7B61FF, transparent)' }}
            />

            {/* Body */}
            <motion.p
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={heroReady ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
              transition={{ duration: 0.9, delay: 1.05 }}
              className="text-[1rem] leading-relaxed mb-10 max-w-[490px] font-body"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              Viaja a través del cosmos y descubre los misterios que el universo
              tiene para revelar.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={heroReady ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 1.2 }}
              className="flex gap-4 flex-wrap"
            >
              <Magnetic>
                <button className="btn-primary" onClick={() => jumpTo(1)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  <span>EXPLORAR UNIVERSO</span>
                </button>
              </Magnetic>
              <Magnetic>
                <button className="btn-secondary" onClick={() => jumpTo(2)}>
                  VER HISTORIA
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </Magnetic>
            </motion.div>
          </motion.div>

        </div>

        {/* Stats bar — centered on full page width */}
        <div className="w-full px-6">
        <div
            className="mx-auto flex items-stretch overflow-hidden"
            style={{
              maxWidth: 'min(820px, 100%)',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(4, 6, 14, 0.88)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {[
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="3.5"/></svg>, n: '8', label: 'PLANETAS', sub: 'EN ÓRBITA' },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M15.536 8.464a5 5 0 010 7.072M8.464 8.464a5 5 0 000 7.072M12 12h.01"/></svg>, n: '∞', label: 'UNIVERSO', sub: 'SIN LÍMITES' },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></svg>, n: '4.6B', label: 'AÑOS LUZ', sub: 'DE HISTORIA' },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="5" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="7" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="19" r="1.5" fill="currentColor" stroke="none"/><line x1="5" y1="5" x2="19" y2="7"/><line x1="19" y1="7" x2="10" y2="16"/><line x1="10" y1="16" x2="18" y2="19"/></svg>, n: '128', label: 'CONSTELACIONES', sub: 'DESCUBIERTAS' },
            ].map((s, i, arr) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 18 }}
                animate={heroReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
                transition={{ duration: 0.7, delay: heroReady ? 1.5 + i * 0.13 : 0 }}
                className="flex flex-col items-center justify-center gap-1.5 px-5 py-4 flex-1 min-w-0"
                style={{ borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <span style={{ color: 'rgba(0,240,255,0.5)', flexShrink: 0 }}>{s.icon}</span>
                <div className="text-center min-w-0">
                  <div className="font-display font-bold text-[1.05rem] leading-none" style={{ color: '#00F0FF' }}>{s.n}</div>
                  <div className="font-display text-[0.62rem] tracking-[1.5px] mt-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{s.label}</div>
                  <div className="font-display text-[0.56rem] tracking-[1px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
        initial={{ opacity: 0 }} animate={heroReady ? { opacity: 1 } : { opacity: 0 }} transition={{ delay: heroReady ? 2.8 : 0, duration: heroReady ? 1 : 0.2 }}
      >
        <span className="font-display text-[0.42rem] tracking-[5px]" style={{ color: 'rgba(255,255,255,0.15)' }}>CONTINUAR</span>
        <div className="w-px h-10" style={{ background: 'linear-gradient(to bottom, rgba(0,240,255,0.22), transparent)', animation: 'scrollPulse 2s ease-in-out infinite' }} />
      </motion.div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   HISTORY — Energy timeline floating in void
═══════════════════════════════════════════════════════════════════════════ */
export function HistorySection() {
  const [openPuzzle, setOpenPuzzle] = useState<number | null>(null)

  return (
    <section id="historia" className="relative z-[1] pt-40 pb-24">
      <div className="max-w-[1320px] mx-auto px-6 sm:px-8 md:px-12 lg:pl-[136px]">

        {/* Zone header */}
        <FadeUp className="text-center mb-4">
          <ZoneLabel text="HISTORIA CÓSMICA" />
        </FadeUp>
        <FadeUp className="text-center" delay={0.1}>
          <h2 className="font-serif text-[clamp(2.6rem,5.5vw,4.5rem)] text-white/75 font-normal italic mb-3">
            Modo Historia
          </h2>
        </FadeUp>
        <FadeUp className="text-center" delay={0.15}>
          <p className="text-slate-500 text-base max-w-[580px] mx-auto mb-20 leading-relaxed">
            Desde el Big Bang hasta el destino final del cosmos.
          </p>
        </FadeUp>

        <div className="relative">
          {/* Energy spine — vertical beam */}
          <div className="absolute left-8 lg:left-1/2 lg:-translate-x-1/2 w-px h-full top-0">
            <div className="w-full h-full" style={{ background: 'linear-gradient(to bottom, transparent, rgba(34,211,238,0.35) 15%, rgba(167,139,250,0.25) 50%, rgba(34,211,238,0.35) 85%, transparent)' }} />
          </div>

          {chapters.map((ch, i) => {
            const isRight = i % 2 === 1
            return (
            <SlideIn key={ch.id} delay={0.05} from={isRight ? 'right' : 'left'} className="relative mb-28">
              <div className={`relative flex gap-10 lg:gap-16 flex-col ${isRight ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>

                {/* Energy node */}
                <div className="absolute left-8 lg:left-1/2 -translate-x-1/2 z-[2] top-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center relative" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.3)' }}>
                    <span className="font-display text-[0.6rem] font-bold text-accent-cyan">{ch.id}</span>
                    <div className="absolute inset-[-3px] rounded-full" style={{ animation: 'orbitPulse 3s ease-in-out infinite', animationDelay: `${i*0.4}s` }} />
                  </div>
                </div>

                {/* Text */}
                <div className={`flex-1 min-w-0 pl-20 lg:pl-0 ${isRight ? 'lg:text-right' : ''}`}>
                  <div className="font-display text-[0.55rem] tracking-[5px] text-accent-cyan/50 uppercase mb-2">{ch.label}</div>
                  <h3 className="font-display text-[clamp(1.5rem,2.8vw,2rem)] font-bold mb-3 text-white/85">{ch.title}</h3>
                  <p className="text-slate-400/85 text-[0.92rem] leading-relaxed mb-4">{ch.text}</p>
                  <div className={`flex flex-wrap gap-2 ${isRight ? 'lg:justify-end' : ''}`}>
                    {ch.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 border border-accent-purple/12 rounded-full text-[0.7rem] text-accent-purple/60 hover:border-accent-purple/35 hover:text-accent-purple/90 transition-colors cursor-pointer">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setOpenPuzzle(openPuzzle === ch.id ? null : ch.id)}
                    className="mt-4 inline-flex items-center gap-2 text-[0.6rem] font-display tracking-[2px] text-accent-gold/55 hover:text-accent-gold transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                    {openPuzzle === ch.id ? 'CERRAR' : 'PUZZLE INTERACTIVO'}
                  </button>
                  <AnimatePresence>
                    {openPuzzle === ch.id && ch.puzzle && <PuzzleGame puzzle={ch.puzzle} onClose={() => setOpenPuzzle(null)} />}
                  </AnimatePresence>
                </div>

                {/* Image */}
                <div className="flex-1 min-w-0 hidden lg:block">
                  <div className="relative h-64 overflow-hidden rounded-xl group">
                    <img src={ch.image} alt={ch.title} loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-80" />
                    {/* Fade towards the spine side */}
                    <div className="absolute inset-0" style={{
                      background: isRight
                        ? 'linear-gradient(to left, rgba(0,0,0,0.85) 0%, transparent 45%)'
                        : 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, transparent 45%)'
                    }} />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.7) 100%)' }} />
                    <div className="absolute top-4 left-4 font-display text-[6rem] font-black leading-none select-none" style={{ color: 'rgba(255,255,255,0.03)' }}>
                      {String(ch.id).padStart(2,'0')}
                    </div>
                  </div>
                </div>

              </div>
            </SlideIn>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTELLATIONS — Full bleed star map
═══════════════════════════════════════════════════════════════════════════ */
export function ConstellationsSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const VIRT_W = 3600, VIRT_H = 2000

  const [offset, setOffset]   = useState({ x: 900, y: 400 })
  const [dragging, setDragging] = useState(false)
  const didDrag = useRef(false)
  const dragRef = useRef({ mx:0, my:0, ox:0, oy:0 })
  const offsetRef = useRef({ x: 900, y: 400 })

  const [filter, setFilter]     = useState('all')
  const [hovered, setHovered]   = useState<ConstellationData | null>(null)
  const [selected, setSelected] = useState<ConstellationData | null>(null)
  const [navDir, setNavDir]     = useState(0)
  const bgStars = useRef<{ x:number;y:number;r:number;o:number;tw:number }[]>([])
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)
  const mapVisibleRef = useRef(true)
  const [customConstellations, setCustomConstellations] = useState<ConstellationData[]>([])
  const customRef = useRef<ConstellationData[]>([])
  customRef.current = customConstellations

  offsetRef.current = offset

  const allConstellations = [...constellations, ...customConstellations]
  const filteredConstellations = allConstellations.filter(c => filter === 'all' || c.type === filter)

  const PANEL_W = 270
  const MAP_H   = 500

  const clamp = (ox: number, oy: number) => {
    const vw = containerRef.current?.clientWidth  ?? 1200
    return { x: Math.max(0, Math.min(VIRT_W - vw, ox)), y: Math.max(0, Math.min(VIRT_H - MAP_H, oy)) }
  }

  const panTo = (c: ConstellationData) => {
    const vw = containerRef.current?.clientWidth ?? 1200
    const cx = c.stars.reduce((a,s) => a + s[0], 0) / c.stars.length * VIRT_W
    const cy = c.stars.reduce((a,s) => a + s[1], 0) / c.stars.length * VIRT_H
    const next = clamp(cx - (vw - PANEL_W) / 2, cy - MAP_H / 2)
    setOffset(next); offsetRef.current = next
  }

  const frameSkipRef = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    if (!mapVisibleRef.current) { animRef.current = 0; return }
    // En celular este canvas redibuja 1100+ estrellas y varios degradados por
    // cuadro a 60fps sobre un lienzo virtual de 3600x2000 — costoso en GPUs
    // móviles. Se limita a ~30fps ahí saltando un cuadro de cada dos; el
    // parpadeo de las estrellas sigue viéndose fluido porque su velocidad
    // (timeRef) no depende del framerate real.
    if (IS_MOBILE) {
      frameSkipRef.current++
      if (frameSkipRef.current % 2 !== 0) {
        animRef.current = requestAnimationFrame(draw)
        return
      }
    }
    const ctx = canvas.getContext('2d')!
    const W = VIRT_W, H = VIRT_H
    timeRef.current += IS_MOBILE ? 0.016 : 0.008
    ctx.clearRect(0, 0, W, H)

    bgStars.current.forEach(s => {
      const f = 0.4 + 0.6 * Math.sin(timeRef.current * s.tw)
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2)
      ctx.fillStyle = `rgba(255,255,255,${s.o*f})`; ctx.fill()
    })

    ;[...constellations, ...customRef.current].forEach(c => {
      if (filter !== 'all' && c.type !== filter) return
      const lit = hovered === c || selected === c

      c.lines.forEach(([a,b]) => {
        const sa=c.stars[a], sb=c.stars[b]
        ctx.beginPath(); ctx.moveTo(sa[0]*W,sa[1]*H); ctx.lineTo(sb[0]*W,sb[1]*H)
        if (lit) {
          const g = ctx.createLinearGradient(sa[0]*W,sa[1]*H,sb[0]*W,sb[1]*H)
          g.addColorStop(0,'rgba(167,139,250,0.95)'); g.addColorStop(1,'rgba(34,211,238,0.95)')
          ctx.strokeStyle=g; ctx.lineWidth=2.2
        } else {
          ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=1
        }
        ctx.stroke()
      })

      c.stars.forEach(s => {
        const px=s[0]*W, py=s[1]*H
        if (lit) {
          const g=ctx.createRadialGradient(px,py,0,px,py,22)
          g.addColorStop(0,'rgba(34,211,238,0.42)'); g.addColorStop(1,'rgba(34,211,238,0)')
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(px,py,22,0,Math.PI*2); ctx.fill()
        }
        ctx.beginPath(); ctx.arc(px,py,lit?5.5:2.8,0,Math.PI*2)
        ctx.fillStyle = lit?'#BFFFFF':'rgba(255,255,255,0.7)'; ctx.fill()
      })

      if (lit) {
        const cx=c.stars.reduce((a,s)=>a+s[0],0)/c.stars.length*W
        const cy=c.stars.reduce((a,s)=>a+s[1],0)/c.stars.length*H
        ctx.font=`bold 11px 'Syne',sans-serif`
        ctx.fillStyle='rgba(34,211,238,0.95)'; ctx.textAlign='center'
        ctx.fillText(c.name.toUpperCase(), cx, cy-26)
      }
    })
    animRef.current = requestAnimationFrame(draw)
  }, [filter, hovered, selected])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.width=VIRT_W; canvas.height=VIRT_H
    bgStars.current = Array.from({length:IS_MOBILE ? 380 : 1100},()=>({
      x:Math.random()*VIRT_W, y:Math.random()*VIRT_H,
      r:Math.random()*1.3+0.3, o:Math.random()*0.5+0.1, tw:Math.random()*2+0.5
    }))
    const vw = containerRef.current?.clientWidth ?? 1200
    const init = clamp((VIRT_W - vw) / 2, (VIRT_H - MAP_H) / 2)
    setOffset(init); offsetRef.current = init
    try {
      const saved = JSON.parse(localStorage.getItem('astra-custom-constellations-v1') || '[]')
      if (Array.isArray(saved) && saved.length > 0) setCustomConstellations(saved as ConstellationData[])
    } catch {}
  }, [])

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    const observer = new IntersectionObserver(([entry]) => {
      mapVisibleRef.current = entry.isIntersecting
      if (entry.isIntersecting && animRef.current === 0) {
        animRef.current = requestAnimationFrame(draw)
      }
    }, { threshold: 0 })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => {
      cancelAnimationFrame(animRef.current)
      observer.disconnect()
    }
  }, [draw])

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true); didDrag.current = false
    dragRef.current = { mx:e.clientX, my:e.clientY, ox:offsetRef.current.x, oy:offsetRef.current.y }
  }

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging) {
      const dx=e.clientX-dragRef.current.mx, dy=e.clientY-dragRef.current.my
      if (Math.abs(dx)>4||Math.abs(dy)>4) didDrag.current=true
      const next = clamp(dragRef.current.ox-dx, dragRef.current.oy-dy)
      setOffset(next); offsetRef.current=next
      return
    }
    // Compensa la magnificación por perspectiva de la capa activa (translateZ
    // en DeepNavEngine.tsx) — sin esto, el hit-test de estrellas quedaría
    // corrido respecto a lo que se ve en pantalla.
    const rect=(e.currentTarget as HTMLElement).getBoundingClientRect()
    const target = e.currentTarget as HTMLElement
    const sx = target.offsetWidth / rect.width, sy = target.offsetHeight / rect.height
    const mx=(e.clientX-rect.left)*sx+offsetRef.current.x
    const my=(e.clientY-rect.top)*sy+offsetRef.current.y
    let found: ConstellationData|null=null
    for (const c of [...constellations, ...customRef.current]) {
      if (filter!=='all'&&c.type!==filter) continue
      for (const s of c.stars) {
        if (Math.sqrt((mx-s[0]*VIRT_W)**2+(my-s[1]*VIRT_H)**2)<28){found=c;break}
      }
      if (found) break
    }
    setHovered(found)
  }

  const onUp    = () => setDragging(false)
  const onLeave = () => { setDragging(false); setHovered(null) }
  const onClick = () => { if (!didDrag.current && hovered) { panTo(hovered); setSelected(hovered) } }

  // ── Soporte táctil ────────────────────────────────────────────────────────
  // Los handlers de arriba solo escuchan mouse. En touch no hay "hover" antes
  // de tocar, así que el arrastre y la selección por tap se resuelven aparte
  // con listeners nativos {passive:false} (para poder frenar el scroll de la
  // página mientras se arrastra el mapa — React adjunta touchmove como pasivo).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let active = false

    const findAt = (mx: number, my: number): ConstellationData | null => {
      for (const c of [...constellations, ...customRef.current]) {
        if (filter !== 'all' && c.type !== filter) continue
        for (const s of c.stars) {
          if (Math.sqrt((mx - s[0]*VIRT_W)**2 + (my - s[1]*VIRT_H)**2) < 28) return c
        }
      }
      return null
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      active = true; didDrag.current = false
      const t = e.touches[0]
      dragRef.current = { mx: t.clientX, my: t.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
      setDragging(true)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!active) return
      e.preventDefault()
      const t = e.touches[0]
      const dx = t.clientX - dragRef.current.mx, dy = t.clientY - dragRef.current.my
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true
      const next = clamp(dragRef.current.ox - dx, dragRef.current.oy - dy)
      setOffset(next); offsetRef.current = next
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!active) return
      active = false
      setDragging(false)
      if (!didDrag.current && e.changedTouches.length) {
        const t = e.changedTouches[0]
        const rect = el.getBoundingClientRect()
        const sx = el.offsetWidth / rect.width, sy = el.offsetHeight / rect.height
        const found = findAt((t.clientX - rect.left) * sx + offsetRef.current.x, (t.clientY - rect.top) * sy + offsetRef.current.y)
        if (found) { panTo(found); setSelected(found) }
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (dir: number) => {
    if (!selected) return
    const idx=filteredConstellations.indexOf(selected); setNavDir(dir)
    const next = filteredConstellations[(idx+dir+filteredConstellations.length)%filteredConstellations.length]
    setSelected(next)
    // Antes solo cambiaba el contenido del panel — el mapa de fondo se
    // quedaba quieto, así que no se veía a qué constelación te movías.
    // panTo() ya existe (se usa al elegir del buscador); reusarlo acá hace
    // que ANTERIOR/SIGUIENTE también desplace la cámara hacia la nueva.
    panTo(next)
  }

  const filters = [{key:'all',label:'Todas'},{key:'zodiacal',label:'Zodiacales'},{key:'boreal',label:'Boreales'},{key:'austral',label:'Australes'},{key:'historica',label:'Históricas'}]

  return (
    <section id="constelaciones" className="relative z-[1] pt-40 pb-24">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 md:px-12 lg:pl-[136px]">
        <FadeUp className="text-center mb-4"><ZoneLabel text="MAPA ESTELAR" /></FadeUp>
        <FadeUp className="text-center" delay={0.1}>
          <h2 className="font-serif text-[clamp(2.6rem,5.5vw,4.5rem)] text-white/75 font-normal italic mb-3">Constelaciones</h2>
        </FadeUp>
        <FadeUp className="text-center" delay={0.15}>
          <p className="text-slate-500 text-base max-w-[560px] mx-auto mb-10 leading-relaxed">
            Arrastra para explorar el mapa estelar completo. Toca cualquier constelación para descubrirla.
          </p>
        </FadeUp>
        <FadeUp delay={0.2} className="flex justify-center gap-3 mb-8 flex-wrap">
          {filters.map(f => (
            <button key={f.key}
              className={`font-display text-[0.6rem] tracking-[2px] px-5 py-2 rounded-full border transition-all duration-300 ${filter===f.key?'border-accent-cyan/50 text-white bg-accent-cyan/8':'border-white/8 text-slate-600 hover:border-accent-cyan/25 hover:text-white'}`}
              onClick={()=>{setFilter(f.key);setSelected(null)}}>
              {f.label}
            </button>
          ))}
        </FadeUp>
        <FadeUp delay={0.22} className="flex justify-center mb-8">
          <ConstellationPicker
            list={allConstellations}
            buttonLabel="BUSCAR CONSTELACIÓN"
            onPick={c => { setFilter('all'); setSelected(c); panTo(c) }}
          />
        </FadeUp>
      </div>

      <FadeUp delay={0.25} className="px-6 sm:px-8 md:px-12 lg:pl-[136px] max-w-[1400px] mx-auto">
        <div
          ref={containerRef}
          className="relative overflow-hidden select-none rounded-2xl w-full"
          style={{ height: MAP_H+'px', cursor: dragging?'grabbing':hovered?'pointer':'grab', background:'#00000a' }}
          onMouseDown={onMouseDown} onMouseMove={onMove} onMouseUp={onUp}
          onMouseLeave={onLeave}   onClick={onClick}
        >
          {/* Virtual star map canvas */}
          <canvas ref={canvasRef} style={{
            position:'absolute', top:0, left:0,
            width:VIRT_W+'px', height:VIRT_H+'px',
            transform:`translate(-${offset.x}px,-${offset.y}px)`,
            transition: dragging ? 'none' : 'transform 0.72s cubic-bezier(0.22,1,0.36,1)',
            imageRendering:'auto',
          }}/>

          {/* Edge fades */}
          <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 80% 65% at 50% 50%,transparent 40%,rgba(0,0,10,0.72) 100%)'}}/>
          <div className="absolute inset-y-0 left-0 w-28 pointer-events-none" style={{background:'linear-gradient(to right,rgba(0,0,10,0.85),transparent)'}}/>
          <div className="absolute inset-y-0 right-0 w-28 pointer-events-none" style={{background:'linear-gradient(to left,rgba(0,0,10,0.85),transparent)'}}/>
          <div className="absolute inset-x-0 top-0 h-16 pointer-events-none" style={{background:'linear-gradient(to bottom,rgba(0,0,10,0.6),transparent)'}}/>
          <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{background:'linear-gradient(to top,rgba(0,0,10,0.6),transparent)'}}/>

          {/* Drag hint */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none z-10" style={{marginRight: selected?'340px':'0', transition:'margin 0.45s cubic-bezier(0.22,1,0.36,1)'}}>
            <span className="font-display text-[0.42rem] tracking-[3px] text-white/20 whitespace-nowrap">
              ARRASTRA PARA EXPLORAR · CLICK EN CONSTELACIÓN
            </span>
          </div>

          {/* Hover name badge */}
          {hovered && !selected && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 pointer-events-none z-10 px-4 py-1.5 rounded-full"
              style={{background:'rgba(0,240,255,0.08)',border:'1px solid rgba(0,240,255,0.18)'}}>
              <span className="font-display text-[0.55rem] tracking-[2.5px] text-accent-cyan/80">{hovered.name.toUpperCase()}</span>
            </div>
          )}

          {/* ── Detail panel slides in from right ───────────────────────── */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
                transition={{duration:0.45,ease:[0.22,1,0.36,1]}}
                className="absolute top-0 right-0 h-full z-30 flex flex-col"
                style={{width:PANEL_W,background:'rgba(2,3,16,0.97)',backdropFilter:'blur(32px)',borderLeft:'1px solid rgba(255,255,255,0.05)'}}
                onClick={e=>e.stopPropagation()}
              >
                {/* Close */}
                <button onClick={()=>setSelected(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/30 hover:text-white/75 active:text-white transition-colors z-10"
                  style={{border:'1px solid rgba(255,255,255,0.09)'}}>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="1" y1="1" x2="8" y2="8"/><line x1="8" y1="1" x2="1" y2="8"/>
                  </svg>
                </button>

                {/* Animated content per constellation */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={selected.name}
                    initial={{opacity:0,x:navDir>=0?60:-60}} animate={{opacity:1,x:0}} exit={{opacity:0,x:navDir>=0?-60:60}}
                    transition={{duration:0.38,ease:[0.22,1,0.36,1]}}
                    className="flex flex-col h-full overflow-hidden">

                    {/* Mini star view — el juego de "conectar los puntos" ya
                        no vive acá adentro: ahora es su propia tarjeta con
                        página flotante, debajo del mapa (ver
                        ConstellationGameCard), independiente de tener una
                        constelación seleccionada en el mapa. */}
                    <ConstellationZoomView constellation={selected} height={200} width={PANEL_W}/>

                    {/* Info */}
                    <div className="flex-1 px-6 py-5 overflow-y-auto" style={{scrollbarWidth:'none'}}>
                      <div className="inline-block px-2.5 py-0.5 rounded-full border border-accent-gold/15 text-accent-gold/50 text-[0.44rem] font-display tracking-[3px] uppercase mb-3">
                        {selected.type==='zodiacal'?'ZODIACAL':selected.type==='boreal'?'BOREAL':selected.type==='austral'?'AUSTRAL':selected.type==='historica'?'HISTÓRICA':'PERSONALIZADA'}
                      </div>
                      <h3 className="font-display text-xl font-bold text-white mb-0.5 leading-tight">{selected.name}</h3>
                      <div className="text-accent-cyan/40 italic text-[0.62rem] mb-4 font-serif">{selected.alias}</div>
                      <p className="text-slate-400/80 leading-relaxed text-[0.68rem] mb-5">{selected.desc}</p>
                      <div className="flex items-start gap-2">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 shrink-0 text-accent-purple/40">
                          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/>
                        </svg>
                        <span className="text-[0.62rem] italic font-serif text-slate-600">{selected.figure}</span>
                      </div>
                    </div>

                    {/* Navigation */}
                    <div className="px-6 py-4 flex items-center justify-between" style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                      <button onClick={()=>navigate(-1)} className="flex items-center gap-1.5 text-white/30 hover:text-white/65 transition-colors">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="15,18 9,12 15,6"/></svg>
                        <span className="font-display text-[0.44rem] tracking-[2px]">ANTERIOR</span>
                      </button>
                      <span className="font-display text-[0.4rem] tracking-[1.5px] text-white/15">
                        {filteredConstellations.indexOf(selected)+1} / {filteredConstellations.length}
                      </span>
                      <button onClick={()=>navigate(1)} className="flex items-center gap-1.5 text-white/30 hover:text-white/65 transition-colors">
                        <span className="font-display text-[0.44rem] tracking-[2px]">SIGUIENTE</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="9,18 15,12 9,6"/></svg>
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FadeUp>

      {/* Dos tarjetas separadas debajo del mapa (antes era un único panel de
          creación siempre abierto): cada una es solo título + indicaciones +
          botón, y el botón abre la herramienta completa como página
          flotante. Se apilan en una columna en celular. */}
      <FadeUp delay={0.3} className="max-w-[1400px] mx-auto px-6 sm:px-8 md:px-12 lg:pl-[136px] mt-14 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ConstellationCreatorCard onSaved={c => {
            setCustomConstellations(prev => [...prev, c])
            setFilter('all'); setSelected(c); panTo(c)
          }} />
          <ConstellationGameCard list={allConstellations} />
        </div>
      </FadeUp>
    </section>
  )
}

function ConstellationZoomView({ constellation, height=320, width=880 }: { constellation: ConstellationData; height?: number; width?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const timeRef   = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const W=width, H=height; canvas.width=W; canvas.height=H
    const bgStars = Array.from({length:IS_MOBILE ? 45 : 100},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.1+0.3,o:Math.random()*0.4+0.1,tw:Math.random()*2+0.5}))
    const xs=constellation.stars.map(s=>s[0]),ys=constellation.stars.map(s=>s[1])
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2
    const span=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),0.05)*2.2
    const pad=38
    const toX=(v:number)=>pad+((v-cx)/span+0.5)*(W-2*pad)
    const toY=(v:number)=>pad+((v-cy)/span+0.5)*(H-2*pad)
    let skip=0

    const draw=()=>{
      // Igual que el mapa principal: en celular se dibuja a ~30fps en vez de
      // 60fps, ya que cada cuadro crea varios degradados (gradients), algo
      // caro para el GPU/CPU de un teléfono.
      if (IS_MOBILE) {
        skip++
        if (skip % 2 !== 0) { animRef.current=requestAnimationFrame(draw); return }
      }
      timeRef.current+=IS_MOBILE ? 0.024 : 0.012
      const ctx=canvas.getContext('2d')!
      ctx.clearRect(0,0,W,H)
      bgStars.forEach(s=>{
        const f=0.3+0.7*Math.sin(timeRef.current*s.tw)
        ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2)
        ctx.fillStyle=`rgba(255,255,255,${s.o*f})`;ctx.fill()
      })
      ctx.save();ctx.globalAlpha=0.04+0.02*Math.sin(timeRef.current*0.4)
      constellation.lines.forEach(([a,b])=>{
        const sa=constellation.stars[a],sb=constellation.stars[b]
        ctx.beginPath();ctx.moveTo(toX(sa[0]),toY(sa[1]));ctx.lineTo(toX(sb[0]),toY(sb[1]))
        ctx.strokeStyle='#22D3EE';ctx.lineWidth=22;ctx.lineCap='round';ctx.stroke()
      });ctx.restore()
      constellation.lines.forEach(([a,b])=>{
        const sa=constellation.stars[a],sb=constellation.stars[b]
        const g=ctx.createLinearGradient(toX(sa[0]),toY(sa[1]),toX(sb[0]),toY(sb[1]))
        g.addColorStop(0,'rgba(167,139,250,0.85)');g.addColorStop(1,'rgba(34,211,238,0.85)')
        ctx.beginPath();ctx.moveTo(toX(sa[0]),toY(sa[1]));ctx.lineTo(toX(sb[0]),toY(sb[1]))
        ctx.strokeStyle=g;ctx.lineWidth=1.7;ctx.stroke()
      })
      constellation.stars.forEach(s=>{
        const px=toX(s[0]),py=toY(s[1])
        const pulse=1+0.14*Math.sin(timeRef.current*2+s[0]*10)
        const glow=ctx.createRadialGradient(px,py,0,px,py,13*pulse)
        glow.addColorStop(0,'rgba(34,211,238,0.55)');glow.addColorStop(1,'rgba(34,211,238,0)')
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(px,py,13*pulse,0,Math.PI*2);ctx.fill()
        ctx.beginPath();ctx.arc(px,py,3.5*pulse,0,Math.PI*2);ctx.fillStyle='#DDFAFF';ctx.fill()
      })
      animRef.current=requestAnimationFrame(draw)
    }
    draw()
    return ()=>cancelAnimationFrame(animRef.current)
  },[constellation,height,width])

  return <canvas ref={canvasRef} style={{width:'100%',height:`${height}px`,display:'block'}}/>
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTELLATION TRACE GAME — "conectar los puntos"

   Se muestran las estrellas reales de la constelación SIN sus líneas. El
   usuario apreta/toca una estrella y ARRASTRA — sale una línea que sigue
   al dedo/mouse en vivo. Al soltar: si cae sobre la estrella correcta, la
   línea se fija; si no cae sobre ninguna estrella (o la sueltan afuera de
   la ventana flotante), la línea se retrae animada de vuelta al punto de
   origen en vez de quedar tirada o desaparecer de golpe.

   Se implementa con Pointer Events (funciona igual con mouse, touch y
   stylus) + setPointerCapture: al capturar el puntero sobre la estrella de
   origen, los eventos de mover/soltar siguen llegando a ese mismo elemento
   pase lo que pase con el dedo/cursor — incluso si sale del SVG — que es
   justo lo que hace falta para poder soltar "afuera" y detectarlo. Para
   convertir la posición de la pantalla a coordenadas del SVG (que puede
   estar escalado por el viewBox) se usa getScreenCTM(), el método nativo
   correcto para eso en vez de cuentas manuales con el bounding box.

   Regla de "no cruzar líneas a menos que la figura real lo requiera": en vez
   de detectar cruces geométricos en vivo (frágil y confuso para el usuario:
   ¿qué cruce es "válido"?), se valida cada intento contra el set real de
   segmentos de `constellation.lines`. Como esas líneas son las coordenadas
   REALES de la constelación, dos líneas de esa lista solo se cruzan en
   pantalla si la figura verdadera se cruza a sí misma ahí — por eso
   aceptar únicamente pares que estén en `lines` ya implementa la regla
   pedida sin necesitar geometría aparte. */
function ConstellationTraceGame({ constellation, height=320, width=880 }: { constellation: ConstellationData; height?: number; width?: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drawn, setDrawn]         = useState<Set<string>>(new Set())
  const [dragFrom, setDragFrom]   = useState<number | null>(null)
  const [dragPos, setDragPos]     = useState<{ x: number; y: number } | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const draggingRef = useRef(false)

  const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  const validKeys = useMemo(() => new Set(constellation.lines.map(([a, b]) => pairKey(a, b))), [constellation])
  const total = constellation.lines.length
  const complete = drawn.size === total

  // Encuadre idéntico al de ConstellationZoomView, para que el juego se vea
  // en la misma posición/escala que la vista normal de la figura.
  const { toX, toY } = useMemo(() => {
    const xs = constellation.stars.map(s => s[0]), ys = constellation.stars.map(s => s[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 0.05) * 2.2
    const pad = 38
    return {
      toX: (v: number) => pad + ((v - cx) / span + 0.5) * (width - 2 * pad),
      toY: (v: number) => pad + ((v - cy) / span + 0.5) * (height - 2 * pad),
    }
  }, [constellation, width, height])

  // Se resetea el progreso cada vez que cambia la constelación mostrada.
  useEffect(() => { setDrawn(new Set()); setDragFrom(null); setDragPos(null) }, [constellation])

  const HIT_R = 20 // radio (en unidades del viewBox) para "atrapar" la estrella de destino al soltar

  const svgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = clientX; pt.y = clientY
    const p = pt.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  const nearestStar = (pos: { x: number; y: number }) => {
    let best: number | null = null, bestD = HIT_R
    constellation.stars.forEach((s, i) => {
      const d = Math.hypot(toX(s[0]) - pos.x, toY(s[1]) - pos.y)
      if (d < bestD) { bestD = d; best = i }
    })
    return best
  }

  const animateSnapBack = (from: { x: number; y: number }, to: { x: number; y: number }, done: () => void) => {
    const t0 = performance.now(), dur = 180
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - t, 2)
      setDragPos({ x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased })
      if (t < 1) requestAnimationFrame(step)
      else done()
    }
    requestAnimationFrame(step)
  }

  const handlePointerDown = (idx: number) => (e: React.PointerEvent) => {
    if (complete) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    draggingRef.current = true
    setDragFrom(idx)
    const s = constellation.stars[idx]
    setDragPos({ x: toX(s[0]), y: toY(s[1]) })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    setDragPos(svgPoint(e.clientX, e.clientY))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current || dragFrom === null) return
    draggingRef.current = false
    const pos = svgPoint(e.clientX, e.clientY)
    const origin = dragFrom
    const originStar = constellation.stars[origin]
    const originPos = { x: toX(originStar[0]), y: toY(originStar[1]) }
    const target = nearestStar(pos)

    if (target !== null && target !== origin) {
      const k = pairKey(origin, target)
      if (validKeys.has(k) && !drawn.has(k)) {
        setDrawn(prev => new Set(prev).add(k))
        setDragFrom(null); setDragPos(null)
        return
      }
    }
    // No cayó sobre la estrella correcta (o esa línea no es real / ya
    // estaba trazada, o la soltaron afuera de la ventana): la línea se
    // retrae de vuelta al punto de origen en vez de quedar suelta.
    setRejecting(true)
    animateSnapBack(pos, originPos, () => { setRejecting(false); setDragFrom(null); setDragPos(null) })
  }

  return (
    <div className="relative" style={{ width: '100%', height, background: '#00000a' }}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
        style={{ display: 'block', touchAction: 'none' }}
        onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
      >
        <defs>
          <linearGradient id="traceGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A78BFA" /><stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>

        {[...drawn].map(k => {
          const [a, b] = k.split('-').map(Number)
          const sa = constellation.stars[a], sb = constellation.stars[b]
          return (
            <line key={k} x1={toX(sa[0])} y1={toY(sa[1])} x2={toX(sb[0])} y2={toY(sb[1])}
              stroke="url(#traceGrad)" strokeWidth={2.2} strokeLinecap="round" opacity={0.95} />
          )
        })}

        {/* Línea "elástico" en vivo mientras se arrastra desde una estrella */}
        {dragFrom !== null && dragPos && (() => {
          const s = constellation.stars[dragFrom]
          return (
            <line x1={toX(s[0])} y1={toY(s[1])} x2={dragPos.x} y2={dragPos.y}
              stroke={rejecting ? '#FB7185' : '#67E8F9'} strokeWidth={2.4} strokeLinecap="round"
              opacity={0.9} style={{ pointerEvents: 'none' }} />
          )
        })()}

        {constellation.stars.map((s, i) => {
          const px = toX(s[0]), py = toY(s[1])
          const isOrigin = dragFrom === i
          return (
            <g key={i} onPointerDown={handlePointerDown(i)} style={{ cursor: complete ? 'default' : 'grab', touchAction: 'none' }}>
              {/* Círculo invisible más grande solo para ampliar el área de agarre en móvil */}
              <circle cx={px} cy={py} r={18} fill="transparent" />
              <circle cx={px} cy={py} r={isOrigin ? 6.5 : 4.5} fill={isOrigin ? '#DDFAFF' : '#fff'} />
            </g>
          )
        })}
      </svg>

      {/* Progreso */}
      <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full font-display text-[0.4rem] tracking-[2px] pointer-events-none"
        style={{ background: 'rgba(2,3,16,0.75)', border: '1px solid rgba(255,255,255,0.08)', color: complete ? '#67e8f9' : 'rgba(255,255,255,0.45)' }}>
        {complete ? '¡FIGURA COMPLETA!' : `${drawn.size} / ${total} LÍNEAS`}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTELLATION PICKER — buscador por tipo → nombre (no es texto libre: se
   navega el árbol tipo→nombre y al tocar un nombre se dispara onPick).
   Se reutiliza tanto en el buscador del mapa principal como en el modal del
   juego de conectar los puntos, para no mantener dos implementaciones.
═══════════════════════════════════════════════════════════════════════════ */
const CONSTELLATION_TYPE_LABELS: Record<string, string> = {
  zodiacal: 'Zodiacales', boreal: 'Boreales', austral: 'Australes',
  historica: 'Históricas', custom: 'Personalizadas',
}
function ConstellationPicker({ list, onPick, buttonLabel = 'BUSCAR' }: {
  list: ConstellationData[]; onPick: (c: ConstellationData) => void; buttonLabel?: string
}) {
  const [open, setOpen]         = useState(false)
  const [openType, setOpenType] = useState<string | null>(null)

  const groups = useMemo(() => {
    const order = ['zodiacal', 'boreal', 'austral', 'historica', 'custom']
    return order
      .map(key => ({ key, label: CONSTELLATION_TYPE_LABELS[key], items: list.filter(c => c.type === key) }))
      .filter(g => g.items.length > 0)
  }, [list])

  const close = () => { setOpen(false); setOpenType(null) }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 font-display text-[0.6rem] tracking-[2px] px-5 py-2 rounded-full border transition-all duration-300 ${open ? 'border-accent-cyan/50 text-white bg-accent-cyan/8' : 'border-white/8 text-slate-600 hover:border-accent-cyan/25 hover:text-white'}`}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        {buttonLabel}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.2s'}}><path d="M12 16l-8-8h16z"/></svg>
      </button>

      {open && (
        <>
          {/* Backdrop invisible: cerrar tocando afuera */}
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[min(92vw,320px)] max-h-[360px] overflow-y-auto rounded-2xl p-2"
            style={{background:'rgba(2,3,16,0.97)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)'}}>
            {groups.map(g => (
              <div key={g.key} className="mb-1 last:mb-0">
                <button onClick={() => setOpenType(t => t === g.key ? null : g.key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-display text-[0.55rem] tracking-[2px] text-white/70 hover:bg-white/5 transition-colors">
                  <span>{g.label}</span>
                  <span className="text-white/25">{g.items.length}</span>
                </button>
                {openType === g.key && (
                  <div className="pl-2 pb-1">
                    {g.items.map(c => (
                      <button key={c.name} onClick={() => { onPick(c); close() }}
                        className="w-full text-left px-3 py-2 rounded-lg text-[0.72rem] text-slate-400 hover:text-accent-cyan hover:bg-accent-cyan/5 transition-colors truncate">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTELLATION CREATOR — custom star-map builder

   Antes vivía siempre visible al fondo de la sección. Ahora es una tarjeta
   compacta (título + indicaciones) con un botón que abre el laboratorio
   completo como página flotante — así la sección no queda tan cargada, y
   el laboratorio se siente como una herramienta a propósito, no algo que
   hay que scrollear de largo para llegar a la galería.
═══════════════════════════════════════════════════════════════════════════ */
function ConstellationCreatorCard({ onSaved }: { onSaved: (c: ConstellationData) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card-glass-static overflow-hidden p-7 flex flex-col h-full">
      <p className="font-display text-[0.52rem] tracking-[3px] text-accent-purple/60 mb-1.5">LABORATORIO ESTELAR</p>
      <h3 className="font-display font-bold text-white/80 text-base tracking-wide leading-tight mb-1.5">Crea tu Constelación</h3>
      <p className="text-[0.82rem] text-slate-500 leading-relaxed mb-6 flex-1">
        Colocá estrellas, trazá líneas entre ellas y ponele un nombre. Al guardarla aparece directo en el mapa estelar.
      </p>
      <button onClick={() => setOpen(true)}
        className="self-start font-display text-[0.5rem] tracking-[2px] px-5 py-2.5 rounded-full text-accent-purple border border-accent-purple/30 hover:bg-accent-purple/10 transition-colors">
        ABRIR LABORATORIO
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <ConstellationCreator
          onClose={() => setOpen(false)}
          onSave={c => { onSaved(c); setOpen(false) }}
        />,
        document.body,
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTELLATION GAME CARD — tarjeta compacta + página flotante con el juego
   de conectar los puntos. Antes vivía embebido dentro de la ficha de cada
   constelación (solo accesible después de tocar una en el mapa); ahora es
   independiente: se elige la constelación a jugar desde el propio modal
   (buscador por tipo→nombre, o "otra al azar"), sin depender del mapa.
═══════════════════════════════════════════════════════════════════════════ */
function ConstellationGameCard({ list }: { list: ConstellationData[] }) {
  const [open, setOpen]     = useState(false)
  const [target, setTarget] = useState<ConstellationData | null>(null)

  const openRandom = () => {
    setTarget(list[Math.floor(Math.random() * list.length)])
    setOpen(true)
  }

  return (
    <div className="card-glass-static overflow-hidden p-7 flex flex-col h-full">
      <p className="font-display text-[0.52rem] tracking-[3px] text-accent-cyan/60 mb-1.5">DESAFÍO ESTELAR</p>
      <h3 className="font-display font-bold text-white/80 text-base tracking-wide leading-tight mb-1.5">Conectá los Puntos</h3>
      <p className="text-[0.82rem] text-slate-500 leading-relaxed mb-6 flex-1">
        Elegí una constelación real y reconstruí su figura tocando las estrellas en el orden correcto.
      </p>
      <button onClick={openRandom}
        className="self-start font-display text-[0.5rem] tracking-[2px] px-5 py-2.5 rounded-full text-accent-cyan border border-accent-cyan/35 hover:bg-accent-cyan/10 transition-colors">
        JUGAR
      </button>
      {open && target && typeof document !== 'undefined' && createPortal(
        <ConstellationGameModal list={list} initial={target} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </div>
  )
}

function ConstellationGameModal({ list, initial, onClose }: {
  list: ConstellationData[]; initial: ConstellationData; onClose: () => void
}) {
  const [current, setCurrent] = useState(initial)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,4,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div className="card-glass-static overflow-hidden w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 sm:px-7 py-5 sm:py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="min-w-0">
            <p className="font-display text-[0.5rem] tracking-[3px] text-accent-cyan/60 mb-1.5">DESAFÍO ESTELAR</p>
            <h3 className="font-display font-bold text-white/80 text-base tracking-wide leading-tight truncate">{current.name}</h3>
            <p className="text-accent-cyan/40 italic text-[0.62rem] font-serif">{current.alias}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/30 hover:text-white/75 active:text-white transition-colors flex-shrink-0"
            style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="1" y1="1" x2="8" y2="8"/><line x1="8" y1="1" x2="1" y2="8"/></svg>
          </button>
        </div>

        <div className="px-5 sm:px-7 pt-4 pb-2 flex items-center gap-2 flex-wrap">
          <ConstellationPicker list={list} buttonLabel="ELEGIR CONSTELACIÓN" onPick={c => setCurrent(c)} />
          <button onClick={() => setCurrent(list[Math.floor(Math.random() * list.length)])}
            className="font-display text-[0.5rem] tracking-[2px] px-4 py-2 rounded-full text-slate-500 border border-white/10 hover:text-white/70 hover:border-white/25 transition-colors">
            OTRA AL AZAR
          </button>
        </div>

        {/* key=current.name fuerza que ConstellationTraceGame se reinicie
            (estrellas/progreso limpios) cada vez que se cambia de figura. */}
        <div className="mx-5 sm:mx-7 mb-4 mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
          <ConstellationTraceGame key={current.name} constellation={current} height={300} width={560} />
        </div>

        <div className="px-5 sm:px-7 pb-6">
          <p className="text-[0.68rem] text-slate-500 leading-relaxed">{current.desc}</p>
        </div>
      </div>
    </div>
  )
}

function ConstellationCreator({ onSave, onClose }: { onSave?: (c: ConstellationData) => void; onClose?: () => void }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const starsRef     = useRef<{x:number;y:number}[]>([])
  const linesRef     = useRef<[number,number][]>([])
  const modeRef      = useRef<'star'|'line'|'erase'>('star')
  const lineStartRef = useRef<number|null>(null)
  const mouseRef     = useRef<{x:number;y:number}|null>(null)

  const [mode, setMode]     = useState<'star'|'line'|'erase'>('star')
  const [name, setName]     = useState('')
  const [feedback, setFeedback] = useState<{text:string;ok:boolean}|null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width / (Math.min(window.devicePixelRatio||1,2))
    const H = canvas.height / (Math.min(window.devicePixelRatio||1,2))

    ctx.clearRect(0, 0, W, H)

    // Subtle nebula background
    const bg = ctx.createRadialGradient(W*.5, H*.4, 0, W*.5, H*.4, W*.6)
    bg.addColorStop(0,   'rgba(88,28,135,0.10)')
    bg.addColorStop(0.6, 'rgba(15,23,60,0.06)')
    bg.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

    // Lines
    linesRef.current.forEach(([i, j]) => {
      const a = starsRef.current[i], b = starsRef.current[j]
      if (!a || !b) return
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
      g.addColorStop(0,   'rgba(167,139,250,0.7)')
      g.addColorStop(0.5, 'rgba(34,211,238,0.7)')
      g.addColorStop(1,   'rgba(167,139,250,0.7)')
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.stroke()
    })

    // Preview dashed line while in line mode
    if (modeRef.current === 'line' && lineStartRef.current !== null && mouseRef.current) {
      const a = starsRef.current[lineStartRef.current]
      if (a) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouseRef.current.x, mouseRef.current.y)
        ctx.strokeStyle = 'rgba(34,211,238,0.28)'; ctx.setLineDash([6,4]); ctx.lineWidth = 1; ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Stars
    starsRef.current.forEach((s, i) => {
      const sel = lineStartRef.current === i
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 18)
      glow.addColorStop(0, sel ? 'rgba(201,168,76,0.35)' : 'rgba(34,211,238,0.22)')
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(s.x, s.y, 18, 0, Math.PI*2)
      ctx.fillStyle = glow; ctx.fill()
      ctx.beginPath(); ctx.arc(s.x, s.y, sel ? 5 : 3.5, 0, Math.PI*2)
      ctx.fillStyle = sel ? '#c9a84c' : '#bfffff'; ctx.fill()
      ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.38)'
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(String(i+1), s.x, s.y - 15)
    })

    // Empty-state hint
    if (starsRef.current.length === 0) {
      ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.11)'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('Haz clic para colocar estrellas', W/2, H/2)
    }
  }, [])

  const getHit = (mx:number, my:number) => {
    for (let i = starsRef.current.length - 1; i >= 0; i--) {
      const s = starsRef.current[i]
      if ((mx-s.x)**2 + (my-s.y)**2 < 18**2) return i
    }
    return null
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const W = canvas.offsetWidth, H = canvas.offsetHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw()
    }

    // La capa activa del stack 3D avanza con translateZ (ver DeepNavEngine.tsx),
    // lo que la magnifica levemente por la perspectiva — sin esta corrección,
    // un click cerca del borde caería un poco afuera de donde se ve la estrella.
    const readPoint = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const sx = canvas.offsetWidth / r.width, sy = canvas.offsetHeight / r.height
      return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
    }

    const handleClick = (e:MouseEvent) => {
      const { x: mx, y: my } = readPoint(e)
      const m = modeRef.current
      if (m === 'star') {
        starsRef.current = [...starsRef.current, {x:mx, y:my}]
        draw()
      } else if (m === 'line') {
        const near = getHit(mx, my)
        if (near === null) return
        if (lineStartRef.current === null) {
          lineStartRef.current = near
        } else if (lineStartRef.current !== near) {
          const [a, b] = [lineStartRef.current, near]
          const dup = linesRef.current.some(([p,q]) => (p===a&&q===b)||(p===b&&q===a))
          if (!dup) linesRef.current = [...linesRef.current, [a, b]]
          lineStartRef.current = null
        } else {
          lineStartRef.current = null
        }
        draw()
      } else if (m === 'erase') {
        const near = getHit(mx, my)
        if (near === null) return
        linesRef.current = linesRef.current
          .filter(([a,b]) => a !== near && b !== near)
          .map(([a,b]) => [a > near ? a-1 : a, b > near ? b-1 : b] as [number,number])
        starsRef.current = starsRef.current.filter((_, i) => i !== near)
        if (lineStartRef.current === near) lineStartRef.current = null
        draw()
      }
    }

    const handleMove = (e:MouseEvent) => {
      mouseRef.current = readPoint(e)
      const near = getHit(mouseRef.current.x, mouseRef.current.y)
      canvas.style.cursor =
        modeRef.current === 'star'  ? 'cell' :
        modeRef.current === 'erase' ? (near !== null ? 'not-allowed' : 'default') :
        near !== null ? 'crosshair' : 'default'
      if (modeRef.current === 'line' && lineStartRef.current !== null) draw()
    }

    const handleLeave = () => { mouseRef.current = null; draw() }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('mousemove', handleMove)
    canvas.addEventListener('mouseleave', handleLeave)
    return () => {
      ro.disconnect()
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('mousemove', handleMove)
      canvas.removeEventListener('mouseleave', handleLeave)
    }
  }, [draw])

  const switchMode = (m:'star'|'line'|'erase') => {
    modeRef.current = m; lineStartRef.current = null; setMode(m); draw()
  }

  const handleClear = () => {
    starsRef.current = []; linesRef.current = []; lineStartRef.current = null
    setName(''); setFeedback(null); draw()
  }

  const handleSave = () => {
    if (!name.trim()) {
      setFeedback({text:'Ponle un nombre a tu constelación', ok:false})
      setTimeout(() => setFeedback(null), 2500); return
    }
    if (starsRef.current.length < 2) {
      setFeedback({text:'Necesitas al menos 2 estrellas', ok:false})
      setTimeout(() => setFeedback(null), 2500); return
    }
    const canvas = canvasRef.current!
    const W = canvas.offsetWidth, H = canvas.offsetHeight
    const saved_name = name.trim()

    // Las estrellas se dibujan en un lienzo grande y suelto (el laboratorio
    // ocupa gran parte de la ventana flotante), así que guardarlas tal cual
    // como fracción de ese lienzo (x/W, y/H) las dejaba con un "spread"
    // dependiente de qué tan junto o separado dibujó el usuario — a veces
    // enorme, a veces minúsculo. Al mostrarlas en el mapa grande o en una
    // vista mini, cada una se auto-encuadra a como si fuera su único
    // tamaño "natural", así que un spread minúsculo se veía perfectamente
    // recortado — pero un spread grande relativo a las constelaciones
    // reales (que rondan ~0.1-0.2 en el espacio normalizado del mapa)
    // hacía que la figura pareciera "gigante" y el nombre quedara flotando
    // lejos de sus propias líneas en el mapa grande. Acá se reescala la
    // figura ya dibujada (conservando su forma y proporciones) a un
    // tamaño estándar comparable al de una constelación real de tamaño
    // mediano, para que se vea consistente en cualquier vista.
    const rawStars = starsRef.current.map(s => [s.x / W, s.y / H] as [number, number])
    const xs = rawStars.map(s => s[0]), ys = rawStars.map(s => s[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const drawCx = (minX + maxX) / 2, drawCy = (minY + maxY) / 2
    const rawSpread = Math.max(maxX - minX, maxY - minY, 0.01)
    const TARGET_SPREAD = 0.16 // spread típico de una constelación real de tamaño mediano
    const scale = TARGET_SPREAD / rawSpread
    // El centro final se mantiene donde el usuario centró su dibujo, pero
    // alejado de los bordes del mapa para que la figura reescalada no
    // termine saliéndose del área visible.
    const finalCx = Math.min(0.85, Math.max(0.15, drawCx))
    const finalCy = Math.min(0.85, Math.max(0.15, drawCy))
    const normalizedStars = rawStars.map(([x, y]) => [
      +(finalCx + (x - drawCx) * scale).toFixed(4),
      +(finalCy + (y - drawCy) * scale).toFixed(4),
    ] as [number, number])

    const entry: ConstellationData = {
      name:   saved_name,
      alias:  'Constelación Personalizada',
      type:   'custom',
      figure: 'Creación personal',
      desc:   `Constelación creada con ${starsRef.current.length} estrellas.`,
      stars:  normalizedStars,
      lines:  linesRef.current.map(([a,b]) => [a,b] as [number,number]),
    }
    try {
      const prev = JSON.parse(localStorage.getItem('astra-custom-constellations-v1') || '[]')
      prev.push(entry); localStorage.setItem('astra-custom-constellations-v1', JSON.stringify(prev))
    } catch {}
    setFeedback({text:`"${saved_name}" guardada en el mapa`, ok:true})
    setName(''); starsRef.current = []; linesRef.current = []; lineStartRef.current = null; draw()
    // Pequeña pausa antes de avisar/cerrar: así el usuario alcanza a ver el
    // mensaje de "guardada" en vez de que la ventana flotante desaparezca
    // de golpe apenas toca Enter o el botón Guardar.
    setTimeout(() => { if (onSave) onSave(entry) }, 700)
  }

  const TOOLS = [
    {k:'star'  as const, icon:'★', label:'ESTRELLA'},
    {k:'line'  as const, icon:'—', label:'LÍNEA'},
    {k:'erase' as const, icon:'✕', label:'BORRAR'},
  ]

  // Antes esto se renderizaba siempre visible, en línea, al fondo de la
  // sección. Ahora vive dentro de una página flotante (portal a document.body)
  // que abre ConstellationCreatorCard — por eso el fondo fijo + el botón de
  // cerrar acá, y por eso `onClose` (además de `onSave`, que ya cierra solo
  // al guardar con éxito).
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{background:'rgba(0,0,4,0.75)', backdropFilter:'blur(10px)'}}
      onClick={onClose}
    >
      <div className="card-glass-static overflow-hidden w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-7 py-5 sm:py-6"
             style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
          <div className="min-w-0">
            <p className="font-display text-[0.5rem] sm:text-[0.52rem] tracking-[3px] text-accent-cyan/60 mb-1.5">
              LABORATORIO ESTELAR
            </p>
            <h3 className="font-display font-bold text-white/80 text-base tracking-wide leading-tight">
              Crea tu Constelación
            </h3>
            <p className="text-[0.78rem] sm:text-[0.82rem] text-slate-500 mt-1.5 leading-relaxed">
              Coloca estrellas · traza líneas · ponle nombre · guárdala.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleClear}
              className="font-display text-[0.44rem] sm:text-[0.47rem] tracking-[2px] px-3 sm:px-4 py-2 rounded-full text-slate-600 hover:text-white/50 transition-colors whitespace-nowrap"
              style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              LIMPIAR
            </button>
            <button onClick={onClose} aria-label="Cerrar"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/30 hover:text-white/75 active:text-white transition-colors"
              style={{border:'1px solid rgba(255,255,255,0.09)'}}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="1" y1="1" x2="8" y2="8"/><line x1="8" y1="1" x2="1" y2="8"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Toolbar: modo de dibujo + nombre, todo en una fila directamente
            encima del lienzo (antes el nombre quedaba suelto debajo). En
            celular se apila en varias filas en vez de comprimirse. */}
        <div className="flex gap-3 items-center flex-wrap px-5 sm:px-7 pt-5 pb-4">
          <div className="flex gap-2 flex-wrap">
            {TOOLS.map(t => (
              <button key={t.k} onClick={() => switchMode(t.k)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-display text-[0.47rem] tracking-[1.5px] border transition-all duration-200 ${
                  mode === t.k
                    ? 'text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10'
                    : 'text-slate-600 border-white/[0.07] hover:text-white/55 hover:border-white/20'
                }`}>
                <span className="text-[0.8rem]">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder="Nombre de tu constelación..." maxLength={40}
            className="flex-1 min-w-[160px] px-4 py-2 rounded-full font-display text-[0.72rem] tracking-wide text-white/70 placeholder-white/20 outline-none transition-all"
            style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)'}}
            onFocus={e => { e.currentTarget.style.borderColor='rgba(34,211,238,0.35)'; e.currentTarget.style.background='rgba(34,211,238,0.04)' }}
            onBlur={e  => { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.background='rgba(255,255,255,0.03)' }}
          />
          {/* Botón "Guardar" explícito: antes la única forma de guardar era
              presionar Enter en el campo de nombre, algo poco descubrible en
              celular (donde tocar Enter en el teclado táctil no siempre es
              obvio). Ahora hay un botón visible en todas las pantallas. */}
          <button onClick={handleSave}
            className="font-display text-[0.5rem] tracking-[2px] px-5 py-2.5 rounded-full text-accent-cyan border border-accent-cyan/35 hover:bg-accent-cyan/10 transition-colors whitespace-nowrap">
            GUARDAR
          </button>
        </div>

        {feedback && (
          <div className="px-5 sm:px-7 pb-2">
            <span className={`inline-block font-display text-[0.5rem] tracking-[2px] px-5 py-2.5 rounded-xl border ${
              feedback.ok
                ? 'text-accent-cyan/80 border-accent-cyan/20'
                : 'text-red-400/80 border-red-400/20'
            }`} style={{background: feedback.ok ? 'rgba(34,211,238,0.06)' : 'rgba(248,113,113,0.06)'}}>
              {feedback.text}
            </span>
          </div>
        )}

        {/* Drawing canvas */}
        <div className="mx-5 sm:mx-7 mb-5 sm:mb-7 rounded-xl overflow-hidden"
             style={{background:'rgba(2,4,20,0.75)', border:'1px solid rgba(255,255,255,0.04)'}}>
          <canvas ref={canvasRef} className="w-full block" style={{height:'300px'}} />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   GALLERY — Floating images in void
═══════════════════════════════════════════════════════════════════════════ */
export function GallerySection() {
  const [abierta, setAbierta] = useState<number | null>(null)

  return (
    <section id="galeria" className="relative z-[1] pt-40 pb-24">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 md:px-12 lg:pl-[136px]">

        <FadeUp className="text-center mb-4">
          <ZoneLabel text="FOTOGRAFÍA ESPACIAL" />
        </FadeUp>
        <FadeUp className="text-center" delay={0.1}>
          <h2 className="font-serif text-[clamp(2.6rem,5.5vw,4.5rem)] text-white/75 font-normal italic mb-3">Galería Cósmica</h2>
        </FadeUp>
        <FadeUp className="text-center" delay={0.15}>
          <p className="text-slate-500 text-base max-w-[540px] mx-auto mb-6 leading-relaxed">
            Las imágenes más impresionantes del universo — tocá una para ver más.
          </p>
        </FadeUp>

        <FadeUp className="flex items-center justify-center gap-2.5 flex-wrap mb-12" delay={0.2}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-display text-[0.46rem] tracking-[2px] text-accent-cyan"
            style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
            {galleryImages.length} FOTOGRAFÍAS
          </span>
          <span className="px-3 py-1 rounded-full font-display text-[0.46rem] tracking-[2px] text-slate-400"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            HUBBLE · JWST · NASA · VOYAGER
          </span>
        </FadeUp>

        {/* Bento/masonry: cada foto tiene un tamaño (grande/ancho/normal, ver
            data.ts) en vez de una grilla pareja — rompe la monotonía y le da
            a la sección una jerarquía visual real. auto-rows + dense evita
            que queden huecos al combinar tiles de distinto tamaño. */}
        <div className="grid grid-cols-2 lg:grid-cols-3 auto-rows-[150px] sm:auto-rows-[180px] lg:auto-rows-[220px] gap-2 lg:gap-3"
          style={{ gridAutoFlow: 'dense' }}>
            {galleryImages.map((img, i) => (
                <ScaleIn key={i} delay={i * 0.05}
                  className={
                    img.tam === 'grande' ? 'col-span-2 row-span-2'
                    : img.tam === 'ancho' ? 'col-span-2 row-span-1'
                    : 'col-span-1 row-span-1'
                  }>
                <button type="button" onClick={() => setAbierta(i)}
                  aria-label={`Ver ${img.alt} en detalle`}
                  className="relative overflow-hidden group cursor-pointer block w-full h-full text-left"
                  style={{ borderRadius: '6px' }}>
                  <img src={img.src} alt={img.alt} loading="lazy"
                    className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-105 opacity-80 group-hover:opacity-95" />
                  {/* Categoría: siempre visible, arriba a la izquierda */}
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full font-display text-[0.42rem] tracking-[2px] text-white/85 uppercase"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {img.categoria}
                  </span>
                  {/* Título: siempre parcialmente visible, se afirma en hover */}
                  <div className="absolute inset-x-0 bottom-0 transition-all duration-500"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 65%)', height: '55%' }} />
                  <div className="absolute bottom-0 left-0 right-0 p-3.5 lg:p-4 translate-y-0.5 opacity-90 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out">
                    <span className={`font-display tracking-[3px] text-white uppercase ${img.tam === 'grande' ? 'text-[0.7rem] lg:text-[0.8rem]' : 'text-[0.55rem]'}`}>{img.alt}</span>
                  </div>
                  {/* Edge energy on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ boxShadow: 'inset 0 0 0 1px rgba(34,211,238,0.25), inset 0 0 24px rgba(34,211,238,0.04)' }} />
                  {/* Lupa: da la pista de que se puede ampliar, sin esperar al hover del mouse en touch */}
                  <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>
                  </div>
                </button>
                </ScaleIn>
            ))}
          </div>
      </div>

      <AnimatePresence>
        {abierta !== null && (
          <GalleryLightbox
            indice={abierta}
            onClose={() => setAbierta(null)}
            onNavegar={(dir) => setAbierta((prev) => {
              if (prev === null) return prev
              const total = galleryImages.length
              return (prev + dir + total) % total
            })}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── Lightbox de la galería ────────────────────────────────────────────────
function GalleryLightbox({ indice, onClose, onNavegar }: { indice: number; onClose: () => void; onNavegar: (dir: 1 | -1) => void }) {
  const img = galleryImages[indice]

  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onNavegar(1)
      else if (e.key === 'ArrowLeft') onNavegar(-1)
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [onClose, onNavegar])

  // Portal a document.body por la misma razón que el modal de rompecabezas de
  // constelaciones (ver más arriba): las secciones viven dentro de un
  // `.deep-layer` con `transform` siempre aplicado, que rompe `position:fixed`.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'rgba(0,0,0,0.86)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <button type="button" onClick={onClose} aria-label="Cerrar"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors z-10"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>

      <button type="button" onClick={(e) => { e.stopPropagation(); onNavegar(-1) }} aria-label="Anterior"
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors z-10"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onNavegar(1) }} aria-label="Siguiente"
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors z-10"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <motion.div
        key={indice}
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="card-glass-static w-full max-w-3xl max-h-[88vh] overflow-y-auto overflow-x-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full flex-shrink-0 bg-black/40" style={{ aspectRatio: '3/2' }}>
          <img src={img.srcDetalle} alt={img.alt} className="w-full h-full object-cover" />
        </div>
        <div className="p-5 sm:p-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-display text-[0.5rem] tracking-[3px] text-accent-cyan">{String(indice + 1).padStart(2, '0')} / {String(galleryImages.length).padStart(2, '0')}</span>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-semibold text-white/90 mb-2">{img.alt}</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{img.descripcion}</p>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MISSIONS — Holographic energy constructs
═══════════════════════════════════════════════════════════════════════════ */
/* ─── Mission game shared types & constants ─────────────────────────────── */
type MissionColorScheme = { text: string; glow: string; border: string }
type MissionGameType = 'sequence' | 'zone' | 'order' | 'mirrors' | 'wave' | 'code'

const CHAIN_MSGS = [
  'Señal biológica transmitida → Parker Solar Probe en espera',
  'Datos de corona solar enviados → Dragonfly listo en Titán',
  'Trayectoria de vuelo confirmada → James Webb apuntando al objetivo',
  'Espejos alineados → LISA Pathfinder detectando ondas',
  'Onda gravitacional registrada → Voyager respondiendo transmisión',
  'SISTEMA DE MONITOREO SOLAR COMPLETAMENTE ACTIVO',
]

const GAME_META: { type: MissionGameType; label: string }[] = [
  { type: 'sequence', label: 'Sondeo de Hielo'       },
  { type: 'zone',     label: 'Girar el Escudo'       },
  { type: 'order',    label: 'Orden de Vuelo'        },
  { type: 'mirrors',  label: 'Alinear Espejos'       },
  { type: 'wave',     label: 'Vuelo Libre'           },
  { type: 'code',     label: 'Código de Transmisión' },
]

const MISSION_DOT_COLORS: Record<string, string> = {
  cyan: '#22d3ee', gold: '#c9a84c', purple: '#a78bfa',
  rose: '#f472b6', emerald: '#34d399', indigo: '#818cf8',
}

// Índice de misión (en `missions`, src/lib/data.ts) → id del motor nuevo
// (public/misiones). Se amplía a medida que se migran más juegos; el resto
// sigue con el placeholder inline de abajo hasta que estén listos.
const MOTOR_MISION_IDS: Record<number, string> = {
  0: 'europa',    // Europa Clipper
  1: 'parker',    // Parker Solar Probe
  2: 'dragonfly', // Dragonfly
  3: 'webb',      // James Webb
  4: 'lisa',      // LISA Pathfinder
  5: 'voyager',   // Voyager 1 & 2
}

/* ─── Game 1: Secuencia de Señales (Europa Clipper) ───────────────────────── */
function SequenceGame({ color, onComplete }: { color: MissionColorScheme; onComplete: () => void }) {
  const BTNS = ['#22d3ee', '#a78bfa', '#c9a84c', '#f472b6']
  const [seq, setSeq]         = useState<number[]>([])
  const [userSeq, setUserSeq] = useState<number[]>([])
  const [phase, setPhase]     = useState<'start'|'show'|'input'|'fail'>('start')
  const [lit, setLit]         = useState<number|null>(null)

  const start = () => {
    const s = Array.from({ length: 3 }, () => Math.floor(Math.random() * 4))
    setSeq(s); setUserSeq([]); setPhase('show')
    let i = 0
    const flash = () => {
      if (i >= s.length) { setLit(null); setPhase('input'); return }
      setLit(s[i]); i++
      setTimeout(() => { setLit(null); setTimeout(flash, 260) }, 560)
    }
    setTimeout(flash, 400)
  }

  const handleBtn = (idx: number) => {
    if (phase !== 'input') return
    const next = [...userSeq, idx]
    if (next[next.length - 1] !== seq[next.length - 1]) { setPhase('fail'); return }
    if (next.length === seq.length) { onComplete(); return }
    setUserSeq(next)
  }

  return (
    <div className="space-y-3">
      {phase === 'start' && (
        <button onClick={start} className={`w-full py-2.5 rounded-xl font-display text-[0.44rem] tracking-[2px] ${color.text} transition-all`}
          style={{ background: color.glow, border: `1px solid ${color.border}` }}>
          INICIAR SECUENCIA
        </button>
      )}
      {(phase === 'show' || phase === 'input') && (
        <>
          <p className="font-display text-[0.42rem] tracking-[2.5px] text-center transition-colors"
            style={{ color: phase === 'show' ? '#22d3ee' : 'rgba(148,163,184,0.35)' }}>
            {phase === 'show' ? 'OBSERVA LA SECUENCIA...' : `REPITE LA SEÑAL — ${userSeq.length}/${seq.length}`}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {BTNS.map((c, i) => (
              <button key={i} onClick={() => handleBtn(i)} disabled={phase === 'show'}
                className="h-10 rounded-lg transition-all duration-200"
                style={{
                  background: lit === i ? c + '44' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${lit === i ? c : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: lit === i ? `0 0 20px ${c}88` : 'none',
                }} />
            ))}
          </div>
        </>
      )}
      {phase === 'fail' && (
        <div className="text-center space-y-2">
          <p className="font-display text-[0.42rem] tracking-[2px] text-red-400/60">✕ SECUENCIA INCORRECTA</p>
          <button onClick={start} className={`font-display text-[0.42rem] tracking-[2px] ${color.text} hover:opacity-75 transition-opacity`}>REINTENTAR →</button>
        </div>
      )}
    </div>
  )
}

/* ─── Game 2: Zona de Captura (Parker Solar Probe) ────────────────────────── */
function ZoneGame({ color, onComplete }: { color: MissionColorScheme; onComplete: () => void }) {
  const [running, setRunning] = useState(false)
  const [missed, setMissed] = useState(false)
  const animRef  = useRef<number>(0)
  const phaseRef = useRef(0)
  const posRef   = useRef(50)
  const indicatorRef = useRef<HTMLDivElement>(null)

  const start = () => {
    setRunning(true); setMissed(false)
    const anim = () => {
      phaseRef.current += 0.042
      posRef.current = 50 + Math.sin(phaseRef.current) * 41
      if (indicatorRef.current) indicatorRef.current.style.left = `calc(${posRef.current}% - 1px)`
      animRef.current = requestAnimationFrame(anim)
    }
    animRef.current = requestAnimationFrame(anim)
  }

  const capture = () => {
    cancelAnimationFrame(animRef.current); setRunning(false)
    if (posRef.current >= 36 && posRef.current <= 64) { onComplete(); return }
    setMissed(true)
  }

  useEffect(() => () => cancelAnimationFrame(animRef.current), [])

  return (
    <div className="space-y-3">
      <div className="relative h-8 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="absolute top-0 h-full"
          style={{ left: '36%', width: '28%', background: 'rgba(201,168,76,0.11)', borderLeft: '1px solid rgba(201,168,76,0.28)', borderRight: '1px solid rgba(201,168,76,0.28)' }} />
        <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 font-display text-[0.38rem] tracking-widest text-accent-gold/30 pointer-events-none">ZONA SEGURA</span>
        {running && (
          <div ref={indicatorRef} className="absolute top-1.5 bottom-1.5 w-0.5 rounded-full"
            style={{ left: `calc(${posRef.current}% - 1px)`, background: '#c9a84c', boxShadow: '0 0 8px #c9a84c', transition: 'none' }} />
        )}
      </div>
      {missed && <p className="font-display text-[0.42rem] tracking-[2px] text-red-400/60 text-center">✕ FUERA DE ZONA — Reinicia</p>}
      {!running ? (
        <button onClick={start} className={`w-full py-2.5 rounded-xl font-display text-[0.44rem] tracking-[2px] ${color.text} transition-all`}
          style={{ background: color.glow, border: `1px solid ${color.border}` }}>
          {missed ? 'REINTENTAR' : 'ACTIVAR SONDA'}
        </button>
      ) : (
        <button onClick={capture} className="w-full py-2.5 rounded-xl font-display text-[0.44rem] tracking-[2px] text-accent-gold transition-all"
          style={{ background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.38)' }}>
          ⬛ CAPTURAR AHORA
        </button>
      )}
    </div>
  )
}

/* ─── Game 3: Orden de Vuelo (Dragonfly) ─────────────────────────────────── */
function OrderGame({ color, onComplete }: { color: MissionColorScheme; onComplete: () => void }) {
  const [tiles, setTiles]   = useState<{ n: number; x: number; y: number }[]>([])
  const [next, setNext]     = useState(1)
  const [timeLeft, setTimeLeft] = useState(7)
  const [started, setStarted]  = useState(false)
  const [failed, setFailed]    = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const start = () => {
    const pos: [number,number][] = [[10,15],[58,15],[10,57],[58,57]]
    const nums = [1,2,3,4].sort(() => Math.random() - 0.5)
    setTiles(nums.map((n, i) => ({ n, x: pos[i][0], y: pos[i][1] })))
    setNext(1); setTimeLeft(7); setStarted(true); setFailed(false)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setFailed(true); setStarted(false); return 0 }
        return t - 1
      })
    }, 1000)
  }

  const hit = (n: number) => {
    if (n !== next) { clearInterval(timerRef.current); setFailed(true); setStarted(false); return }
    if (n === 4) { clearInterval(timerRef.current); onComplete(); return }
    setNext(n + 1)
  }

  useEffect(() => () => clearInterval(timerRef.current), [])

  return (
    <div className="space-y-3">
      {failed && <p className="font-display text-[0.42rem] tracking-[2px] text-red-400/60 text-center">✕ TRAYECTORIA PERDIDA</p>}
      {!started && (
        <button onClick={start} className={`w-full py-2.5 rounded-xl font-display text-[0.44rem] tracking-[2px] ${color.text} transition-all`}
          style={{ background: color.glow, border: `1px solid ${color.border}` }}>
          {failed ? 'REINTENTAR' : 'INICIAR NAVEGACIÓN'}
        </button>
      )}
      {started && (
        <>
          <div className="flex justify-between">
            <span className="font-display text-[0.42rem] tracking-[2px] text-slate-500">WAYPOINT {next}/4</span>
            <span className={`font-display text-[0.42rem] tracking-[2px] transition-colors ${timeLeft <= 2 ? 'text-red-400' : color.text}`}>{timeLeft}s</span>
          </div>
          <div className="relative rounded-lg overflow-hidden"
            style={{ height: '105px', background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.08)' }}>
            {tiles.map(t => (
              <button key={t.n} onClick={() => hit(t.n)}
                className="absolute w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold transition-all duration-150"
                style={{
                  left: `${t.x}%`, top: `${t.y}%`,
                  background: t.n < next ? 'rgba(167,139,250,0.04)' : t.n === next ? 'rgba(167,139,250,0.22)' : 'rgba(167,139,250,0.07)',
                  border: `1px solid ${t.n === next ? 'rgba(167,139,250,0.55)' : 'rgba(167,139,250,0.14)'}`,
                  color: t.n < next ? 'rgba(167,139,250,0.18)' : t.n === next ? '#a78bfa' : 'rgba(167,139,250,0.38)',
                  fontSize: '0.72rem',
                  boxShadow: t.n === next ? '0 0 14px rgba(167,139,250,0.28)' : 'none',
                  opacity: t.n < next ? 0.3 : 1,
                }}>
                {t.n}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Game 4: Alinear Espejos (James Webb) ───────────────────────────────── */
function MirrorsGame({ color, onComplete }: { color: MissionColorScheme; onComplete: () => void }) {
  const [order, setOrder]     = useState<number[]>([])
  const [clicked, setClicked] = useState<number[]>([])
  const [phase, setPhase]     = useState<'start'|'show'|'input'|'fail'>('start')

  const start = () => {
    const o = [0,1,2,3,4,5].sort(() => Math.random() - 0.5)
    setOrder(o); setClicked([]); setPhase('show')
    setTimeout(() => setPhase('input'), 2000)
  }

  const hit = (seg: number) => {
    if (phase !== 'input') return
    if (seg !== order[clicked.length]) { setPhase('fail'); return }
    const next = [...clicked, seg]
    if (next.length === 6) { onComplete(); return }
    setClicked(next)
  }

  return (
    <div className="space-y-3">
      {phase === 'start' && (
        <button onClick={start} className={`w-full py-2.5 rounded-xl font-display text-[0.44rem] tracking-[2px] ${color.text} transition-all`}
          style={{ background: color.glow, border: `1px solid ${color.border}` }}>
          INICIAR ALINEACIÓN
        </button>
      )}
      {(phase === 'show' || phase === 'input') && (
        <>
          <p className="font-display text-[0.42rem] tracking-[2.5px] text-center transition-colors"
            style={{ color: phase === 'show' ? '#f472b6' : 'rgba(244,114,182,0.35)' }}>
            {phase === 'show' ? 'MEMORIZA EL ORDEN...' : `SEGMENTO ${clicked.length + 1} / 6`}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[0,1,2,3,4,5].map(s => {
              const seqPos = order.indexOf(s) + 1
              const done   = clicked.includes(s)
              const isNext = phase === 'input' && !done && s === order[clicked.length]
              return (
                <button key={s} onClick={() => hit(s)}
                  className="h-11 rounded-lg flex items-center justify-center font-display font-bold transition-all duration-200"
                  style={{
                    background: done ? 'rgba(244,114,182,0.14)' : 'rgba(244,114,182,0.04)',
                    border: `1px solid ${isNext ? 'rgba(244,114,182,0.45)' : done ? 'rgba(244,114,182,0.3)' : 'rgba(244,114,182,0.1)'}`,
                    color: phase === 'show' ? '#f472b6' : 'rgba(244,114,182,0.2)',
                    fontSize: phase === 'show' ? '0.72rem' : '0',
                    boxShadow: isNext ? '0 0 12px rgba(244,114,182,0.2)' : 'none',
                  }}>
                  {phase === 'show' ? seqPos : ''}
                </button>
              )
            })}
          </div>
        </>
      )}
      {phase === 'fail' && (
        <div className="text-center space-y-2">
          <p className="font-display text-[0.42rem] tracking-[2px] text-red-400/60">✕ ALINEACIÓN INCORRECTA</p>
          <button onClick={start} className={`font-display text-[0.42rem] tracking-[2px] ${color.text} hover:opacity-75 transition-opacity`}>REINTENTAR →</button>
        </div>
      )}
    </div>
  )
}

/* ─── Game 5: Detectar la Onda (LISA Pathfinder) ─────────────────────────── */
function WaveGame({ color, onComplete }: { color: MissionColorScheme; onComplete: () => void }) {
  const [running, setRunning] = useState(false)
  const [missed, setMissed]   = useState(false)
  const animRef  = useRef<number>(0)
  const phaseRef = useRef(0)
  const barHRef  = useRef(0.5)
  const barRef   = useRef<HTMLDivElement>(null)

  const start = () => {
    setRunning(true); setMissed(false)
    const anim = () => {
      phaseRef.current += 0.038
      barHRef.current = (Math.sin(phaseRef.current) + 1) / 2
      if (barRef.current) barRef.current.style.height = `${barHRef.current * 100}%`
      animRef.current = requestAnimationFrame(anim)
    }
    animRef.current = requestAnimationFrame(anim)
  }

  const detect = () => {
    cancelAnimationFrame(animRef.current); setRunning(false)
    if (barHRef.current > 0.78) { onComplete(); return }
    setMissed(true)
  }

  useEffect(() => () => cancelAnimationFrame(animRef.current), [])

  return (
    <div className="space-y-3">
      {running && (
        <div className="relative h-16 rounded-lg overflow-hidden"
          style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.08)' }}>
          <div className="absolute left-0 right-0 h-px pointer-events-none"
            style={{ top: '22%', background: 'rgba(52,211,153,0.28)' }} />
          <span className="absolute right-2 font-display text-[0.37rem] tracking-widest text-accent-emerald/30 pointer-events-none" style={{ top: '20%' }}>PICO</span>
          <div ref={barRef} className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 rounded-t-sm"
            style={{ height: `${barHRef.current * 100}%`, background: `rgba(52,211,153,${0.28 + barHRef.current * 0.55})`, boxShadow: barHRef.current > 0.78 ? '0 0 18px rgba(52,211,153,0.55)' : 'none', transition: 'none' }} />
        </div>
      )}
      {missed && <p className="font-display text-[0.42rem] tracking-[2px] text-red-400/60 text-center">✕ SEÑAL DÉBIL — REINICIA</p>}
      {!running ? (
        <button onClick={start} className={`w-full py-2.5 rounded-xl font-display text-[0.44rem] tracking-[2px] ${color.text} transition-all`}
          style={{ background: color.glow, border: `1px solid ${color.border}` }}>
          {missed ? 'REINTENTAR' : 'INICIAR DETECTOR'}
        </button>
      ) : (
        <button onClick={detect} className="w-full py-2.5 rounded-xl font-display text-[0.44rem] tracking-[2px] text-accent-emerald transition-all"
          style={{ background: 'rgba(52,211,153,0.13)', border: '1px solid rgba(52,211,153,0.36)' }}>
          ⬛ DETECTAR AHORA
        </button>
      )}
    </div>
  )
}

/* ─── Game 6: Código de Transmisión (Voyager) ────────────────────────────── */
function CodeGame({ color, onComplete }: { color: MissionColorScheme; onComplete: () => void }) {
  const [phase, setPhase]   = useState<'start'|'show'|'input'>('start')
  const [code, setCode]     = useState('')
  const [input, setInput]   = useState('')
  const [failed, setFailed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(3)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const startGame = () => {
    const c = String(Math.floor(1000 + Math.random() * 9000))
    setCode(c); setInput(''); setFailed(false); setPhase('show'); setTimeLeft(3)
    let t = 3
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      t--; setTimeLeft(t)
      if (t <= 0) { clearInterval(timerRef.current); setPhase('input') }
    }, 1000)
  }

  const submit = () => {
    if (input === code) { onComplete(); return }
    setFailed(true); setInput('')
  }

  useEffect(() => () => clearInterval(timerRef.current), [])

  return (
    <div className="space-y-3">
      {phase === 'start' && (
        <button onClick={startGame} className={`w-full py-2.5 rounded-xl font-display text-[0.44rem] tracking-[2px] ${color.text} transition-all`}
          style={{ background: color.glow, border: `1px solid ${color.border}` }}>
          RECIBIR TRANSMISIÓN
        </button>
      )}
      {phase === 'show' && (
        <div className="text-center space-y-1">
          <p className="font-display text-[0.42rem] tracking-[2.5px] text-slate-500">MEMORIZA EL CÓDIGO — {timeLeft}s</p>
          <div className="font-display text-3xl font-bold tracking-[0.4em] text-accent-indigo">{code}</div>
        </div>
      )}
      {phase === 'input' && (
        <div className="space-y-2">
          {failed && <p className="font-display text-[0.42rem] tracking-[2px] text-red-400/60 text-center">✕ CÓDIGO INCORRECTO</p>}
          <p className="font-display text-[0.42rem] tracking-[2.5px] text-slate-500 text-center">INGRESA EL CÓDIGO</p>
          <div className="flex gap-2">
            <input type="text" maxLength={4} value={input}
              onChange={e => setInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="0000" autoFocus
              className="flex-1 px-3 py-2 rounded-lg text-center font-display text-sm tracking-[0.35em] outline-none"
              style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)', color: '#818cf8' }} />
            <button onClick={submit} className="px-4 py-2 rounded-lg font-display text-[0.44rem] tracking-[2px] text-accent-indigo transition-all"
              style={{ background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.28)' }}>
              OK
            </button>
          </div>
          {failed && (
            <button onClick={startGame} className="w-full font-display text-[0.42rem] tracking-[2px] text-slate-500 hover:text-white/50 transition-colors text-center">
              NUEVA TRANSMISIÓN →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Mission card (wraps info + active game) ─────────────────────────────── */
function MissionCard({ mission, colorScheme, icon, gameType, gameLabel, chainMsg, completed, onComplete, motorMisionId }: {
  mission: typeof missions[0]
  colorScheme: MissionColorScheme
  icon: React.ReactNode
  gameType: MissionGameType
  gameLabel: string
  chainMsg: string
  completed: boolean
  onComplete: () => void
  // Si está presente, ACTIVAR abre el minijuego a pantalla completa del
  // motor nuevo (public/misiones) en vez del placeholder inline de abajo.
  motorMisionId?: string
}) {
  const [gameActive, setGameActive] = useState(false)
  // Nota: NO se difumina la capa activa acá (a diferencia de PuzzleGame, que
  // sí lo hace porque se renderiza en un portal aparte, ENCIMA del blur). El
  // placeholder de esta tarjeta se dibuja inline, dentro de la misma capa
  // que se difuminaría — llamar a setOverlayOpen acá dejaba el propio juego
  // ilegible detrás de su blur en cuanto se activaba.

  const handleActivar = () => {
    if (motorMisionId) {
      abrirMisionDelMotor(motorMisionId, { onSuperada: () => onComplete() })
    } else {
      setGameActive(true)
    }
  }

  const GameComponent = {
    sequence: SequenceGame,
    zone:     ZoneGame,
    order:    OrderGame,
    mirrors:  MirrorsGame,
    wave:     WaveGame,
    code:     CodeGame,
  }[gameType]

  return (
    <div className="holo-card h-full flex flex-col relative overflow-hidden rounded-2xl p-7 group cursor-default"
      style={{ border: `1px solid ${colorScheme.border}` }}>

      {/* HUD corners */}
      {['top-2.5 left-2.5 border-t border-l rounded-tl-sm','top-2.5 right-2.5 border-t border-r rounded-tr-sm','bottom-2.5 left-2.5 border-b border-l rounded-bl-sm','bottom-2.5 right-2.5 border-b border-r rounded-br-sm'].map((pos,j)=>(
        <div key={j} className={`absolute w-2.5 h-2.5 ${pos} border-white/10 group-hover:border-white/30 transition-colors duration-300`} />
      ))}

      {/* Scanline */}
      <div className="holo-scan absolute inset-x-0 h-[1px] pointer-events-none opacity-0 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg,transparent,${colorScheme.glow.replace('0.12','0.5')},transparent)` }} />

      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ boxShadow: `inset 0 0 0 1px ${colorScheme.border}, 0 0 35px ${colorScheme.glow}` }} />

      {/* Header row */}
      <div className="flex items-start justify-between mb-5 relative z-[1]">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorScheme.text}`}
          style={{ background: colorScheme.glow }}>
          {icon}
        </div>
        <div className="flex items-center gap-2">
          {completed && <span className={`font-display text-[0.44rem] tracking-[2px] ${colorScheme.text}`}>✓ ACTIVA</span>}
          {mission.chapter && <span className="text-[0.48rem] font-display tracking-[2px] text-slate-400">CAP.{mission.chapter}</span>}
        </div>
      </div>

      <h3 className="font-display text-[0.95rem] font-bold mb-2 tracking-wide text-white/85 relative z-[1]">{mission.title}</h3>
      <p className="text-slate-400 text-[0.82rem] leading-relaxed mb-4 flex-1 relative z-[1]">{mission.desc}</p>

      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-display text-[0.48rem] tracking-[2px] self-start relative z-[1] mb-4 ${mission.active ? 'text-green-400' : 'text-slate-400'}`}
        style={{ background: mission.active ? 'rgba(74,222,128,0.06)' : 'rgba(100,100,100,0.06)', border: `1px solid ${mission.active ? 'rgba(74,222,128,0.15)' : 'rgba(100,100,100,0.15)'}` }}>
        {mission.active && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
        {mission.status}
      </div>

      {/* Game zone */}
      <div className="relative z-[1]"
        style={{ borderTop: `1px solid ${colorScheme.border}`, paddingTop: '14px', marginTop: '2px' }}>

        {!completed && !gameActive && (
          <button onClick={handleActivar}
            className={`w-full py-2.5 rounded-xl font-display text-[0.44rem] tracking-[2px] ${colorScheme.text} transition-all duration-200 hover:opacity-90`}
            style={{ background: colorScheme.glow, border: `1px solid ${colorScheme.border}` }}>
            ACTIVAR — {gameLabel}
          </button>
        )}

        {gameActive && !completed && !motorMisionId && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={`font-display text-[0.42rem] tracking-[2.5px] ${colorScheme.text}`}>INTERFAZ ACTIVA</span>
              <button onClick={() => setGameActive(false)} className="text-slate-600 hover:text-white/50 transition-colors text-xs leading-none">✕</button>
            </div>
            <GameComponent color={colorScheme} onComplete={() => { onComplete(); setGameActive(false) }} />
          </div>
        )}

        {completed && (
          <div className="space-y-2">
            <div className={`w-full py-2 rounded-xl font-display text-[0.44rem] tracking-[2px] text-center ${colorScheme.text}`}
              style={{ background: colorScheme.glow, border: `1px solid ${colorScheme.border}` }}>
              ✓ SEÑAL TRANSMITIDA
            </div>
            <p className="font-display text-[0.38rem] tracking-[1.5px] text-slate-400 text-center leading-relaxed">{chainMsg}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MISSIONS — Mission control with linked mini-games
═══════════════════════════════════════════════════════════════════════════ */
export function MissionsSection() {
  const [completed, setCompleted] = useState<number[]>([])
  const allDone = completed.length === missions.length

  const iconMap: Record<string, React.ReactNode> = {
    globe:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 0 1 0 20M12 2a7 7 0 0 0 0 20M2 12h20"/></svg>,
    star:      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>,
    rocket:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>,
    telescope: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924a.934.934 0 0 0 .702-1.108l-.537-2.15a1.07 1.07 0 0 0-1.265-.691L13 8"/><path d="m10 14 2 8M14 14l-2 8"/></svg>,
    wave:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 12c1-3 3-5 5-5s3 3 5 3 3-5 5-5 3 2 5 5"/><path d="M2 17c1-3 3-5 5-5s3 3 5 3 3-5 5-5 3 2 5 5"/></svg>,
    satellite: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13"/><path d="m17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17"/><path d="m8 11 4 4"/><path d="m11 8 4 4"/><path d="m21 3-8.7 8.7"/><circle cx="19" cy="5" r="1"/></svg>,
  }

  const colorMap: Record<string, MissionColorScheme> = {
    cyan:    { text: 'text-accent-cyan',    glow: 'rgba(34,211,238,0.12)',   border: 'rgba(34,211,238,0.18)'   },
    gold:    { text: 'text-accent-gold',    glow: 'rgba(240,192,96,0.12)',   border: 'rgba(240,192,96,0.18)'   },
    purple:  { text: 'text-accent-purple',  glow: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.18)'  },
    rose:    { text: 'text-accent-rose',    glow: 'rgba(244,114,182,0.12)',  border: 'rgba(244,114,182,0.18)'  },
    emerald: { text: 'text-accent-emerald', glow: 'rgba(52,211,153,0.12)',   border: 'rgba(52,211,153,0.18)'   },
    indigo:  { text: 'text-accent-indigo',  glow: 'rgba(129,140,248,0.12)',  border: 'rgba(129,140,248,0.18)'  },
  }

  const handleComplete = (i: number) => {
    setCompleted(prev => prev.includes(i) ? prev : [...prev, i])
  }

  return (
    <section id="misiones" className="relative z-[1] pt-40 pb-24">
      <div className="max-w-[1320px] mx-auto px-6 sm:px-8 md:px-12 lg:pl-[136px]">

        <FadeUp className="text-center mb-4">
          <ZoneLabel text="CENTRO DE CONTROL" />
        </FadeUp>
        <FadeUp className="text-center" delay={0.1}>
          <h2 className="font-serif text-[clamp(2.6rem,5.5vw,4.5rem)] text-white/75 font-normal italic mb-3">Misiones Activas</h2>
        </FadeUp>
        <FadeUp className="text-center" delay={0.15}>
          <p className="text-slate-500 text-base max-w-[540px] mx-auto mb-8 leading-relaxed">
            Señales en tiempo real desde los confines del sistema solar.
          </p>
        </FadeUp>

        {/* Progress chain indicator */}
        <FadeUp delay={0.18} className="flex items-center justify-center gap-3 mb-12">
          <span className="font-display text-[0.48rem] tracking-[2px] text-slate-400">SISTEMA DE CONTROL</span>
          <div className="flex gap-1.5">
            {missions.map((m, i) => (
              <div key={i} className="w-2 h-2 rounded-full transition-all duration-500"
                style={{
                  background: completed.includes(i) ? MISSION_DOT_COLORS[m.color] : 'rgba(255,255,255,0.08)',
                  boxShadow: completed.includes(i) ? `0 0 6px ${MISSION_DOT_COLORS[m.color]}` : 'none',
                }} />
            ))}
          </div>
          <span className={`font-display text-[0.48rem] tracking-[2px] transition-colors duration-500 ${allDone ? 'text-green-400' : 'text-slate-400'}`}>
            {completed.length}/{missions.length}
          </span>
        </FadeUp>

        {/* All-missions completed banner */}
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }}
              className="mb-10 px-8 py-5 rounded-2xl text-center"
              style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }}>
              <p className="font-display text-[0.52rem] tracking-[4px] text-green-400">
                ✓ SISTEMA SOLAR DE MONITOREO COMPLETAMENTE ACTIVADO
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {missions.map((m, i) => {
            const c = colorMap[m.color] ?? colorMap.cyan
            return (
              <ScaleIn key={m.title} delay={i * 0.07}>
                <MissionCard
                  mission={m} colorScheme={c}
                  icon={iconMap[m.icon] ?? iconMap.globe}
                  gameType={GAME_META[i].type}
                  gameLabel={GAME_META[i].label}
                  chainMsg={CHAIN_MSGS[i]}
                  completed={completed.includes(i)}
                  onComplete={() => handleComplete(i)}
                  motorMisionId={MOTOR_MISION_IDS[i]}
                />
              </ScaleIn>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER — Pure void
═══════════════════════════════════════════════════════════════════════════ */
export function Footer() {
  return (
    <footer id="contacto" className="relative z-[1] pt-40 pb-14">
      {/* Transmission-end line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(110,231,255,0.18), transparent)' }} />

      <div className="max-w-[1320px] mx-auto px-6 sm:px-8 md:px-12 lg:pl-[136px] flex flex-col items-center gap-12">

        {/* Wordmark */}
        <div className="text-center">
          <div className="font-display font-bold tracking-[6px] text-[1.1rem] leading-none mb-2">
            <span style={{ color: '#F8FAFC' }}>ASTRA </span>
            <span style={{ color: '#6EE7FF' }}>NOVA</span>
          </div>
          <div className="font-display text-[0.42rem] tracking-[6px]" style={{ color: 'rgba(148,163,184,0.22)' }}>
            EXPLORACIÓN ESPACIAL INTERACTIVA
          </div>
        </div>

        {/* Nav links */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {['Inicio','Sistema Solar','Historia','Constelaciones','Galería','Misiones'].map(l => (
            <a
              key={l}
              href={`#${l.toLowerCase().replace(/ /g,'-')}`}
              className="font-display text-[0.52rem] tracking-[2.5px] transition-colors duration-300"
              style={{ color: 'rgba(148,163,184,0.25)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(110,231,255,0.55)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.25)' }}
            >
              {l.toUpperCase()}
            </a>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: 'rgba(110,231,255,0.04)' }} />

        {/* Copyright */}
        <div className="font-display text-[0.45rem] tracking-[4px]" style={{ color: 'rgba(148,163,184,0.15)' }}>
          © 2025 ASTRA NOVA — FIN DE TRANSMISIÓN
        </div>
      </div>
    </footer>
  )
}
