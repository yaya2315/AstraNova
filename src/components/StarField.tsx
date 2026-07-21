'use client'

import { useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration — tune these to adjust appearance and performance.
// All parameters are hot-swappable: change values and HMR picks them up.
// ─────────────────────────────────────────────────────────────────────────────
const CFG = {
  // Base star counts [far, mid, near]. Multiplied by 0.60 on mobile (<768px).
  // Set any entry to 0 to disable that layer.
  COUNT: [200, 110, 45] as const,

  // Bloom (cross-sparkle) stars
  BLOOM_COUNT:  14,
  BLOOM_ENABLE: true,

  // Parallax: max pixel offset per axis when mouse is at screen edge
  PARALLAX_MAX: 22,
  // Per-layer multiplier [far, mid, near, bloom] — higher = more parallax
  PARALLAX_MUL: [0.25, 0.65, 1.30, 1.60] as const,
  // Lerp smoothing factor (lower = more cinematic lag, higher = snappier)
  PARALLAX_LERP: 0.048,

  // Twinkle angular speed per layer [far, mid, near, bloom] (rad/s)
  TWINKLE_SPD: [0.22, 0.42, 0.62, 0.28] as const,
  // Twinkle amplitude: 0 = static brightness, 0.30 = ±30% variation
  TWINKLE_AMP: 0.30,

  // Shooting stars
  SHOOT_ENABLE:   true,
  SHOOT_INTERVAL: [8, 22] as const,  // random interval in seconds [min, max]
  SHOOT_MAX:      2,                  // max simultaneously active

  // Base colors (RGB triples, used in rgba() calls)
  STAR_RGB:   '215, 225, 255' as string,  // cold blue-white
  BLOOM_RGB:  '255, 252, 230' as string,  // warm white
  ACCENT_RGB: '240, 198, 88'  as string,  // gold for sparkle tips
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Module-level mouse state — zero rerenders, shared across instances
// ─────────────────────────────────────────────────────────────────────────────
const mouse = { x: 0, y: 0, tx: 0, ty: 0 }  // x/y = smoothed, tx/ty = target

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Star = {
  nx: number  // normalized x [0, 1]
  ny: number  // normalized y [0, 1]
  r:  number  // radius in logical pixels
  a:  number  // base alpha
  ph: number  // twinkle phase offset (radians)
  sp: number  // twinkle angular speed (rad/s)
}

type BloomStar = Star & {
  rot:    number  // cross-sparkle rotation angle (radians)
  rotSpd: number  // rotation speed (rad/s)
}

type Meteor = {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  tail: number  // trail length in logical px
}

// ─────────────────────────────────────────────────────────────────────────────
// Generators — called ONCE on mount, never per frame
// ─────────────────────────────────────────────────────────────────────────────
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function makeStars(
  n: number,
  rMin: number, rMax: number,
  aMin: number, aMax: number,
  baseSp: number,
): Star[] {
  return Array.from({ length: n }, () => ({
    nx: Math.random(),
    ny: Math.random(),
    r:  rnd(rMin, rMax),
    a:  rnd(aMin, aMax),
    ph: rnd(0, Math.PI * 2),
    sp: baseSp * rnd(0.6, 1.5),  // per-star speed variation
  }))
}

function makeBloom(n: number): BloomStar[] {
  return Array.from({ length: n }, () => ({
    nx:     Math.random(),
    ny:     Math.random(),
    r:      rnd(2.5, 5.0),
    a:      rnd(0.65, 1.0),
    ph:     rnd(0, Math.PI * 2),
    sp:     CFG.TWINKLE_SPD[3] * rnd(0.7, 1.4),
    rot:    rnd(0, Math.PI / 4),
    rotSpd: rnd(0.012, 0.055),   // gentle, slow sparkle rotation
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw primitives — pure functions, ctx passed explicitly (no closure)
// ─────────────────────────────────────────────────────────────────────────────

// Bloom star: soft radial halo + solid core + 4-ray cross sparkle with gold tips
function drawBloom(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  r: number, alpha: number, rot: number,
) {
  // Radial glow halo
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5)
  halo.addColorStop(0,   `rgba(${CFG.BLOOM_RGB}, ${alpha.toFixed(3)})`)
  halo.addColorStop(0.3, `rgba(${CFG.ACCENT_RGB}, ${(alpha * 0.30).toFixed(3)})`)
  halo.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.globalAlpha = 1
  ctx.fillStyle   = halo
  ctx.beginPath()
  ctx.arc(x, y, r * 4.5, 0, Math.PI * 2)
  ctx.fill()

  // Solid core dot
  ctx.fillStyle = `rgba(${CFG.BLOOM_RGB}, ${alpha.toFixed(3)})`
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()

  // Cross sparkle: 4 rays drawn in local rotated space
  const rayLen = r * 7.5
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2
    const ex    = Math.cos(angle) * rayLen
    const ey    = Math.sin(angle) * rayLen
    const gr    = ctx.createLinearGradient(0, 0, ex, ey)
    gr.addColorStop(0,    `rgba(${CFG.BLOOM_RGB}, ${(alpha * 0.92).toFixed(3)})`)
    gr.addColorStop(0.20, `rgba(${CFG.ACCENT_RGB}, ${(alpha * 0.40).toFixed(3)})`)
    gr.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.strokeStyle = gr
    ctx.lineWidth   = Math.max(0.5, r * 0.42)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }
  ctx.restore()
}

// Shooting star: gradient tail + glowing tip
function drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor) {
  const prog   = m.life / m.maxLife
  const alpha  = Math.sin(prog * Math.PI) * 0.92
  const sp     = Math.hypot(m.vx, m.vy)
  const tailPx = m.tail * Math.min(prog * 3, 1)   // tail grows in during entry
  const tx     = m.x - (m.vx / sp) * tailPx
  const ty     = m.y - (m.vy / sp) * tailPx

  const gr = ctx.createLinearGradient(tx, ty, m.x, m.y)
  gr.addColorStop(0,    'rgba(180,215,255,0)')
  gr.addColorStop(0.55, `rgba(180,215,255,${(alpha * 0.32).toFixed(3)})`)
  gr.addColorStop(1,    `rgba(255,255,255,${alpha.toFixed(3)})`)
  ctx.globalAlpha = 1
  ctx.strokeStyle = gr
  ctx.lineWidth   = 1.1 + prog * 0.8
  ctx.beginPath()
  ctx.moveTo(tx, ty)
  ctx.lineTo(m.x, m.y)
  ctx.stroke()

  // Glowing tip
  const gw = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 10)
  gw.addColorStop(0, `rgba(255,255,255,${(alpha * 0.78).toFixed(3)})`)
  gw.addColorStop(1, 'rgba(180,215,255,0)')
  ctx.fillStyle = gw
  ctx.beginPath()
  ctx.arc(m.x, m.y, 10, 0, Math.PI * 2)
  ctx.fill()
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas  = canvasRef.current!
    const ctx     = canvas.getContext('2d', { alpha: true })!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // ── Canvas sizing ─────────────────────────────────────────────────────
    const DPR_CAP = 1.5
    let W = 0, H = 0, dpr = 1

    const resize = () => {
      dpr           = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      W             = window.innerWidth
      H             = window.innerHeight
      canvas.width  = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      // Canvas resize auto-resets the context transform; re-applied via setTransform each frame.
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    // ── Generate stars ONCE on mount ──────────────────────────────────────
    // Stars use normalized coords (nx, ny ∈ [0,1]) — multiplied by W/H each
    // frame. On resize they automatically fill the new viewport; no re-generation.
    const mobile = W < 768
    const dm     = mobile ? 0.60 : 1.0  // density multiplier

    const farStars  = makeStars(Math.round(CFG.COUNT[0] * dm), 0.4, 1.0, 0.15, 0.35, CFG.TWINKLE_SPD[0])
    const midStars  = makeStars(Math.round(CFG.COUNT[1] * dm), 0.7, 1.6, 0.28, 0.55, CFG.TWINKLE_SPD[1])
    const nearStars = makeStars(Math.round(CFG.COUNT[2] * dm), 1.0, 2.8, 0.48, 0.85, CFG.TWINKLE_SPD[2])
    const bloomList = CFG.BLOOM_ENABLE ? makeBloom(Math.round(CFG.BLOOM_COUNT * dm)) : []

    // ── Shooting star pool ────────────────────────────────────────────────
    const meteors: Meteor[] = []
    let nextMeteor = rnd(CFG.SHOOT_INTERVAL[0], CFG.SHOOT_INTERVAL[1])

    // ── drawLayer — defined once per mount (not per frame) ────────────────
    // Draws one star layer with parallax offset + per-star twinkle.
    const drawLayer = (stars: Star[], pMul: number, t: number) => {
      const ox  = reduced ? 0 : mouse.x * CFG.PARALLAX_MAX * pMul
      const oy  = reduced ? 0 : mouse.y * CFG.PARALLAX_MAX * pMul
      const amp = reduced ? 0 : CFG.TWINKLE_AMP
      ctx.fillStyle = `rgb(${CFG.STAR_RGB})`
      for (const s of stars) {
        const tw    = amp > 0 ? 1 - amp + amp * Math.sin(t * s.sp + s.ph) : 1
        const alpha = Math.max(0, Math.min(1, s.a * tw))
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(s.nx * W + ox, s.ny * H + oy, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // ── Render loop ───────────────────────────────────────────────────────
    let raf     = 0
    let active  = true   // false when scrolled off-screen
    let visible = true   // false when tab is hidden
    const t0    = performance.now()
    let lastT   = t0

    const frame = (now: number) => {
      const dt = Math.min((now - lastT) / 1000, 0.05)
      const t  = (now - t0) / 1000
      lastT = now

      if (active && visible) {
        // Smooth mouse toward target (zero-cost when reduced=true: lerp=0)
        const lp = reduced ? 0 : CFG.PARALLAX_LERP
        mouse.x += (mouse.tx - mouse.x) * lp
        mouse.y += (mouse.ty - mouse.y) * lp

        // Re-apply DPR scale each frame (canvas resize clears transform)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, W, H)

        // Far → mid → near (back to front)
        drawLayer(farStars,  CFG.PARALLAX_MUL[0], t)
        drawLayer(midStars,  CFG.PARALLAX_MUL[1], t)
        drawLayer(nearStars, CFG.PARALLAX_MUL[2], t)

        // ── Bloom (sparkle) stars ────────────────────────────────────────
        if (CFG.BLOOM_ENABLE) {
          const ox  = reduced ? 0 : mouse.x * CFG.PARALLAX_MAX * CFG.PARALLAX_MUL[3]
          const oy  = reduced ? 0 : mouse.y * CFG.PARALLAX_MAX * CFG.PARALLAX_MUL[3]
          const amp = reduced ? 0 : CFG.TWINKLE_AMP
          for (const s of bloomList) {
            const tw    = amp > 0 ? 1 - amp + amp * Math.sin(t * s.sp + s.ph) : 1
            const alpha = Math.max(0, Math.min(1, s.a * tw))
            s.rot += s.rotSpd * dt  // slow sparkle rotation
            drawBloom(ctx, s.nx * W + ox, s.ny * H + oy, s.r, alpha, s.rot)
          }
        }

        // ── Shooting stars ────────────────────────────────────────────────
        if (CFG.SHOOT_ENABLE && !reduced) {
          nextMeteor -= dt
          if (nextMeteor <= 0 && meteors.length < CFG.SHOOT_MAX) {
            const angle = Math.PI * (0.08 + Math.random() * 0.20)
            const spd   = 460 + Math.random() * 400
            meteors.push({
              x:       Math.random() * W * 0.78,
              y:       Math.random() * H * 0.44,
              vx:      Math.cos(-angle) * spd,
              vy:      Math.sin(angle)  * spd,
              life:    0,
              maxLife: 0.38 + Math.random() * 0.52,
              tail:    80   + Math.random() * 130,
            })
            nextMeteor = rnd(CFG.SHOOT_INTERVAL[0], CFG.SHOOT_INTERVAL[1])
          }
          for (let i = meteors.length - 1; i >= 0; i--) {
            const m = meteors[i]
            m.life += dt
            if (m.life >= m.maxLife) { meteors.splice(i, 1); continue }
            m.x += m.vx * dt
            m.y += m.vy * dt
            drawMeteor(ctx, m)
          }
        }

        ctx.globalAlpha = 1  // clean slate for next frame
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // ── Pause when tab hidden ─────────────────────────────────────────────
    const onVis = () => { visible = !document.hidden }
    document.addEventListener('visibilitychange', onVis)

    // ── Pause when canvas off-screen ──────────────────────────────────────
    const io = new IntersectionObserver(([e]) => { active = e.isIntersecting }, { threshold: 0 })
    io.observe(canvas)

    // ── Mouse parallax tracking ───────────────────────────────────────────
    const onMouse = (e: MouseEvent) => {
      mouse.tx = (e.clientX / window.innerWidth  - 0.5) * 2  // [-1, 1]
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2  // [-1, 1]
    }
    window.addEventListener('mousemove', onMouse, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        display: 'block',
        zIndex: 2,
      }}
    />
  )
}
