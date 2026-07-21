'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Star {
  x: number; y: number; r: number; baseO: number; o: number
  phase: number; freq: number
}

interface DustParticle {
  x: number; y: number; r: number; o: number
  vx: number; vy: number; phase: number
}

interface Sparkle {
  x: number; y: number; life: number; maxLife: number; size: number
}

interface ShootingStar {
  x: number; y: number; len: number; speed: number
  angle: number; opacity: number; life: number; maxLife: number
}

export default function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 })
  const scrollRef = useRef(0)
  const imgLayerRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current.tx = e.clientX / window.innerWidth
    mouseRef.current.ty = e.clientY / window.innerHeight
  }, [])

  const handleScroll = useCallback(() => {
    scrollRef.current = window.scrollY
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [handleMouseMove, handleScroll])

  // Image parallax + glow tracking
  useEffect(() => {
    let raf: number
    const animate = () => {
      const m = mouseRef.current
      m.x += (m.tx - m.x) * 0.04
      m.y += (m.ty - m.y) * 0.04

      if (imgLayerRef.current) {
        const px = (m.x - 0.5) * -20
        const py = (m.y - 0.5) * -12
        const sy = scrollRef.current * -0.08
        imgLayerRef.current.style.transform = `translate3d(${px}px, ${py + sy}px, 0) scale(1.12)`
      }

      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(600px circle at ${m.x * 100}% ${m.y * 100}%, rgba(139,92,246,0.06), rgba(6,182,212,0.03), transparent 70%)`
      }

      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Canvas: stars, dust, sparkles, shooting stars
  useEffect(() => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    let stars: Star[] = []
    let dust: DustParticle[] = []
    let sparkles: Sparkle[] = []
    let shootingStars: ShootingStar[] = []
    let raf: number
    let time = 0

    function resize() {
      c.width = window.innerWidth
      c.height = window.innerHeight

      stars = Array.from({ length: 400 }, () => ({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        r: Math.random() * 1.4 + 0.2,
        baseO: Math.random() * 0.45 + 0.1,
        o: 0,
        phase: Math.random() * Math.PI * 2,
        freq: Math.random() * 0.6 + 0.2,
      }))

      dust = Array.from({ length: 120 }, () => ({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        r: Math.random() * 1.8 + 0.3,
        o: Math.random() * 0.15 + 0.03,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1 + 0.02,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    function spawnSparkle() {
      sparkles.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        life: 0,
        maxLife: 20 + Math.random() * 30,
        size: Math.random() * 2.5 + 1,
      })
    }

    function spawnShootingStar() {
      const side = Math.random()
      let x: number, y: number, angle: number
      if (side < 0.5) {
        x = Math.random() * c.width; y = -10
        angle = Math.PI * 0.3 + Math.random() * 0.4
      } else {
        x = c.width + 10; y = Math.random() * c.height * 0.4
        angle = Math.PI * 0.6 + Math.random() * 0.3
      }
      shootingStars.push({
        x, y, len: 70 + Math.random() * 100,
        speed: 9 + Math.random() * 7,
        angle, opacity: 0.6 + Math.random() * 0.4,
        life: 0, maxLife: 35 + Math.random() * 30,
      })
    }

    function draw() {
      time += 0.016
      const m = mouseRef.current
      ctx.clearRect(0, 0, c.width, c.height)

      // Stars with twinkling
      for (const s of stars) {
        const twinkle = Math.sin(time * s.freq + s.phase)
        s.o = s.baseO + twinkle * 0.25
        s.o = Math.max(0.03, Math.min(1, s.o))

        // Mouse proximity brightening
        const dx = s.x - m.x * c.width, dy = s.y - m.y * c.height
        const dist = Math.sqrt(dx * dx + dy * dy)
        const proximity = Math.max(0, 1 - dist / 300) * 0.3

        const finalO = Math.min(1, s.o + proximity)

        if (s.r > 1.0 && finalO > 0.4) {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(160,170,255,${finalO * 0.06})`
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(210,215,255,${finalO})`
        ctx.fill()
      }

      // Cosmic dust
      for (const d of dust) {
        d.x += d.vx + Math.sin(time * 0.3 + d.phase) * 0.08
        d.y += d.vy
        if (d.x > c.width + 5) d.x = -5
        if (d.x < -5) d.x = c.width + 5
        if (d.y > c.height + 5) d.y = -5
        if (d.y < -5) d.y = c.height + 5

        const pulse = 0.7 + 0.3 * Math.sin(time * 0.5 + d.phase)

        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r * pulse, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(180,160,220,${d.o * pulse})`
        ctx.fill()
      }

      // Random sparkles
      if (Math.random() < 0.06) spawnSparkle()
      sparkles = sparkles.filter((sp) => {
        sp.life++
        const progress = sp.life / sp.maxLife
        const alpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7
        if (alpha <= 0) return false

        // 4-point star sparkle
        const cx = sp.x, cy = sp.y, sz = sp.size * alpha
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(cx - sz * 3, cy); ctx.lineTo(cx + sz * 3, cy)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx, cy - sz * 3); ctx.lineTo(cx, cy + sz * 3)
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(cx, cy, sz, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`
        ctx.fill()

        return sp.life < sp.maxLife
      })

      // Shooting stars
      if (Math.random() < 0.006) spawnShootingStar()
      shootingStars = shootingStars.filter((ss) => {
        ss.life++
        ss.x += Math.cos(ss.angle) * ss.speed
        ss.y += Math.sin(ss.angle) * ss.speed

        const progress = ss.life / ss.maxLife
        const fade = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85
        const alpha = ss.opacity * Math.max(0, fade)
        if (alpha <= 0) return false

        const tailX = ss.x - Math.cos(ss.angle) * ss.len
        const tailY = ss.y - Math.sin(ss.angle) * ss.len

        const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(0.6, `rgba(180,190,255,${alpha * 0.3})`)
        grad.addColorStop(1, `rgba(255,255,255,${alpha})`)

        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(ss.x, ss.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.8
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(ss.x, ss.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fill()

        return ss.life < ss.maxLife && ss.x > -120 && ss.x < c.width + 120 && ss.y < c.height + 120
      })

      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {/* Layer 0: Deep black base */}
      <div className="fixed inset-0 bg-[#010108] z-0" />

      {/* Layer 1: Galaxy image with parallax */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div
          ref={imgLayerRef}
          className="absolute -inset-[12%] will-change-transform"
          style={{ transform: 'translate3d(0,0,0) scale(1.12)' }}
        >
          <img
            src="/space-bg.jpg"
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.55) saturate(1.3) contrast(1.1)' }}
          />
        </div>
      </div>

      {/* Layer 2: Vignette + depth gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(1,1,10,0.7)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(1,1,10,0.4)] via-transparent to-[rgba(1,1,10,0.6)]" />
      </div>

      {/* Layer 3: Mouse-reactive glow */}
      <div
        ref={glowRef}
        className="fixed inset-0 z-0 pointer-events-none will-change-[background] transition-none"
      />

      {/* Layer 4: Canvas particles (stars, dust, sparkles, shooting stars) */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full z-0 pointer-events-none"
      />

      {/* Layer 5: Animated nebula glow accents */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] right-[20%] w-[600px] h-[600px] bg-accent-purple/[0.03] rounded-full blur-[150px] animate-[nebulaPulse_12s_ease-in-out_infinite]" />
        <div className="absolute bottom-[20%] left-[15%] w-[500px] h-[500px] bg-accent-cyan/[0.025] rounded-full blur-[130px] animate-[nebulaPulse_15s_ease-in-out_infinite_3s]" />
        <div className="absolute top-[55%] right-[40%] w-[400px] h-[400px] bg-accent-indigo/[0.02] rounded-full blur-[120px] animate-[nebulaPulse_18s_ease-in-out_infinite_6s]" />
      </div>

      {/* Layer 6: Aurora borealis curtains - animated flowing waves */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Aurora 1 - Purple dominant */}
        <div className="absolute -top-1/3 left-0 w-full h-full bg-gradient-to-b from-transparent via-accent-purple/[0.08] to-transparent
                        animate-[auroraWave_25s_ease-in-out_infinite] origin-top"
             style={{
               clipPath: 'polygon(0 0%, 5% 20%, 10% 5%, 15% 25%, 20% 10%, 25% 30%, 30% 15%, 35% 35%, 40% 20%, 45% 40%, 50% 25%, 55% 45%, 60% 30%, 65% 50%, 70% 35%, 75% 55%, 80% 40%, 85% 60%, 90% 45%, 95% 65%, 100% 50%, 100% 100%, 0 100%)'
             }}
        />

        {/* Aurora 2 - Cyan/Indigo blend */}
        <div className="absolute -top-1/4 left-0 w-full h-full bg-gradient-to-b from-transparent via-accent-cyan/[0.05] to-transparent
                        animate-[auroraWave_30s_ease-in-out_infinite_reverse] origin-top"
             style={{
               clipPath: 'polygon(0 20%, 8% 35%, 16% 18%, 24% 38%, 32% 22%, 40% 42%, 48% 26%, 56% 46%, 64% 30%, 72% 50%, 80% 34%, 88% 54%, 96% 38%, 100% 60%, 100% 100%, 0 100%)'
             }}
        />

        {/* Aurora 3 - Indigo glow layer */}
        <div className="absolute -top-1/2 left-0 w-full h-full bg-gradient-to-b from-transparent via-accent-indigo/[0.04] to-transparent
                        animate-[auroraWave_35s_ease-in-out_infinite] origin-top"
             style={{
               clipPath: 'polygon(0 10%, 3% 15%, 6% 8%, 9% 18%, 12% 5%, 15% 20%, 18% 3%, 21% 22%, 24% 0%, 27% 25%, 30% 2%, 33% 28%, 36% 5%, 39% 31%, 42% 8%, 45% 34%, 48% 12%, 51% 37%, 54% 15%, 57% 40%, 60% 18%, 63% 43%, 66% 22%, 69% 46%, 72% 25%, 75% 49%, 78% 28%, 81% 52%, 84% 32%, 87% 55%, 90% 35%, 93% 58%, 96% 38%, 99% 61%, 100% 42%, 100% 100%, 0 100%)'
             }}
        />

        {/* Aurora shimmer accent - fast moving highlight */}
        <div className="absolute -top-1/3 left-0 w-full h-full bg-gradient-to-b from-accent-cyan/[0.03] via-accent-purple/[0.02] to-transparent
                        animate-[auroraShimmer_20s_ease-in-out_infinite] origin-top"
             style={{
               clipPath: 'polygon(0 15%, 10% 28%, 20% 12%, 30% 32%, 40% 10%, 50% 36%, 60% 8%, 70% 40%, 80% 6%, 90% 44%, 100% 4%, 100% 100%, 0 100%)'
             }}
        />
      </div>
    </>
  )
}
