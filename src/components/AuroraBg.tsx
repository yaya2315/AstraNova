'use client'

import { useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Vertex shader — fullscreen triangle passthrough
// One large triangle covers the entire NDC clip space with a single draw call.
// ─────────────────────────────────────────────────────────────────────────────
const VERT = /* glsl */`
attribute vec2 aPos;
varying   vec2 vUv;
void main() {
  vUv         = aPos * 0.5 + 0.5;   /* NDC [-1,1] → UV [0,1] */
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Fragment shader — aurora borealis
//
// Tunable uniforms:
//   uSpeed      — animation speed multiplier          (default 0.18)
//   uIntensity  — overall brightness of aurora bands  (default 0.72)
//   uGrain      — film grain opacity                  (default 0.028)
//   uColor1/2/3 — aurora band colors, RGB in [0,1]
//   uAccent     — peak-edge accent color, RGB in [0,1]
// ─────────────────────────────────────────────────────────────────────────────
const FRAG = /* glsl */`
precision mediump float;

uniform float uTime;
uniform float uSpeed;
uniform float uIntensity;
uniform float uGrain;
uniform vec2  uResolution;
uniform vec3  uColor1;   /* teal / cyan   */
uniform vec3  uColor2;   /* violet        */
uniform vec3  uColor3;   /* magenta       */
uniform vec3  uAccent;   /* gold (subtle) */

varying vec2 vUv;

/* ── Value noise ──────────────────────────────────────────────────────────── */
float h1(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float sn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i),             h1(i + vec2(1.0, 0.0)), u.x),
             mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), u.x), u.y);
}

/* 2-octave FBM — smooth medium-frequency organic shapes */
float fbm(vec2 p) {
  return sn(p) * 0.62 + sn(p * 2.1 + 17.3) * 0.38;
}

/* ── Aurora curtain ───────────────────────────────────────────────────────── */
/* Each band hangs DOWN from a noise-displaced roof.
   freq  : horizontal warp frequency of the roof
   spd   : horizontal drift speed
   yRoof : base roof height in UV space (1 = top of screen)
   fade  : vertical decay length of the curtain rays              */
float curtain(vec2 uv, float t, float freq, float spd, float yRoof, float fade) {
  float n    = fbm(vec2(uv.x * freq + t * spd, t * 0.04));
  float roof = yRoof + n * 0.18;
  float below = max(0.0, roof - uv.y);             /* 0 above roof, positive below */
  float rays  = fbm(vec2(uv.x * 9.0 + n * 3.0, t * 0.13)); /* vertical striations */
  return exp(-below * (1.0 / fade)) * (0.48 + 0.52 * rays);
}

void main() {
  vec2  uv  = vUv;
  float t   = uTime * uSpeed;
  float ar  = uResolution.x / uResolution.y;
  vec2  uva = vec2(uv.x * ar, uv.y); /* aspect-correct UV for horizontal noise */

  /* ── Band 1 — Teal/cyan: dominant, broad, slow ─────────────────────────── */
  float b1 = curtain(uva, t,       0.65, 0.75, 0.80, 0.24);
  b1 *= 0.72 + 0.28 * sin(uva.x * 6.5  + t * 0.32 + fbm(uva * 2.6 + t * 0.05) * 3.0);

  /* ── Band 2 — Violet: medium, phase-shifted ─────────────────────────────── */
  float b2 = curtain(uva, t + 2.1, 1.05, 0.60, 0.73, 0.16);
  b2 *= 0.65 + 0.35 * sin(uva.x * 10.5 - t * 0.26 + fbm(uva * 2.2 - t * 0.07) * 2.6);

  /* ── Band 3 — Magenta: narrow filaments, faster ─────────────────────────── */
  float b3 = curtain(uva, t - 1.4, 1.60, 0.95, 0.76, 0.09);
  b3 *= 0.58 + 0.42 * sin(uva.x * 16.0 + t * 0.52 + fbm(uva * 3.8 + t * 0.09) * 2.0);

  /* ── Color composition ──────────────────────────────────────────────────── */
  vec3 col = vec3(0.016, 0.024, 0.040); /* #04060a — deep space base */

  col += uColor1 * b1 * uIntensity;
  col += uColor2 * b2 * uIntensity * 0.78;
  col += uColor3 * b3 * uIntensity * 0.60;

  /* Bloom: self-illumination brightens the peaks organically */
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += col * pow(max(lum - 0.04, 0.0), 1.75) * 0.50;

  /* Gold accent — only at the very brightest roof edges */
  float peak = max(b1, max(b2, b3));
  col += uAccent * pow(peak, 5.5) * 0.055;

  /* ── Vignetting ─────────────────────────────────────────────────────────── */
  float vFade = smoothstep(0.04, 0.22, uv.y)   /* fade in from bottom */
              * smoothstep(1.00, 0.78, uv.y);   /* fade out at very top */
  col *= vFade;

  float hFade = smoothstep(0.0, 0.09, uv.x) * smoothstep(1.0, 0.91, uv.x);
  col = mix(col * 0.55, col, hFade);

  /* ── Film grain — micro-texture at very low opacity ─────────────────────── */
  float grain = (h1(uv + fract(uTime * 0.013)) * 2.0 - 1.0) * uGrain;
  col = clamp(col + grain, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`

// ─────────────────────────────────────────────────────────────────────────────
// WebGL helpers
// ─────────────────────────────────────────────────────────────────────────────
function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s)
    gl.deleteShader(s)
    throw new Error(`AuroraBg shader error: ${info}`)
  }
  return s
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AuroraBg({ pauseOnMobile = false }: { pauseOnMobile?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // `pauseOnMobile` lo controla PremiumSpaceExperience según la capa activa
  // (true cuando el Sistema Solar 3D está al frente). Va en un ref, no en el
  // array de dependencias del efecto de abajo, para no tener que destruir y
  // recrear todo el contexto WebGL cada vez que el usuario navega de capa —
  // el loop de animación ya corre, solo lee el valor más nuevo cada cuadro.
  const pauseRef = useRef(pauseOnMobile)
  useEffect(() => { pauseRef.current = pauseOnMobile }, [pauseOnMobile])

  useEffect(() => {
    const canvas = canvasRef.current!

    // Respect prefers-reduced-motion — show static CSS fallback instead
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas.style.display = 'none'
      return
    }

    // ── WebGL context ─────────────────────────────────────────────────────
    const gl = (
      canvas.getContext('webgl',  { antialias: false, alpha: false, depth: false, stencil: false }) ??
      canvas.getContext('experimental-webgl', { antialias: false, alpha: false, depth: false })
    ) as WebGLRenderingContext | null

    if (!gl) {
      // No WebGL — CSS fallback via .aurora-no-webgl class on parent
      canvas.style.display = 'none'
      canvas.parentElement?.classList.add('aurora-no-webgl')
      return
    }

    // ── Compile & link ────────────────────────────────────────────────────
    const prog = gl.createProgram()!
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VERT))
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(`AuroraBg link error: ${gl.getProgramInfoLog(prog)}`)
    gl.useProgram(prog)

    // ── Fullscreen triangle ───────────────────────────────────────────────
    // Three vertices forming one large triangle that covers the full NDC square.
    // More efficient than a quad (2 triangles + index buffer).
    const vbo = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1,  3, -1,  -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    // ── Uniform locations ─────────────────────────────────────────────────
    const uTime       = gl.getUniformLocation(prog, 'uTime')
    const uSpeed      = gl.getUniformLocation(prog, 'uSpeed')
    const uIntensity  = gl.getUniformLocation(prog, 'uIntensity')
    const uGrain      = gl.getUniformLocation(prog, 'uGrain')
    const uResolution = gl.getUniformLocation(prog, 'uResolution')
    const uColor1     = gl.getUniformLocation(prog, 'uColor1')
    const uColor2     = gl.getUniformLocation(prog, 'uColor2')
    const uColor3     = gl.getUniformLocation(prog, 'uColor3')
    const uAccent     = gl.getUniformLocation(prog, 'uAccent')

    // Default values — change these to restyle the aurora.
    // To adjust at runtime, expose setters or read from CSS custom properties.
    gl.uniform1f(uSpeed,    0.18)
    gl.uniform1f(uIntensity, 0.72)
    gl.uniform1f(uGrain,    0.028)
    gl.uniform3f(uColor1,   0.00, 0.85, 0.78)  // --aurora-1: teal/cyan
    gl.uniform3f(uColor2,   0.46, 0.10, 0.90)  // --aurora-2: violet
    gl.uniform3f(uColor3,   0.88, 0.06, 0.64)  // --aurora-3: magenta
    gl.uniform3f(uAccent,   0.94, 0.75, 0.36)  // --aurora-accent: gold

    // ── Resize handler ────────────────────────────────────────────────────
    const DPR_CAP = 1.25
    const resize = () => {
      const dpr   = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      const scale = window.innerWidth < 768 ? 0.75 : 1.0  // halve resolution on mobile
      const w     = Math.round(window.innerWidth  * dpr * scale)
      const h     = Math.round(window.innerHeight * dpr * scale)
      canvas.width  = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uResolution, w, h)
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    // ── Render loop ───────────────────────────────────────────────────────
    let raf     = 0
    let active  = true   // set false by IntersectionObserver when off-screen
    let visible = true   // set false by visibilitychange when tab hidden
    const t0    = performance.now()

    const frame = (now: number) => {
      // En celular, mientras el Sistema Solar 3D (otro contexto WebGL aparte
      // de este) está al frente, esta aurora de fondo queda casi tapada de
      // todos modos — pausarla ahí libera GPU para lo que sí se ve.
      const pausedForHeavyLayer = pauseRef.current && window.innerWidth < 768
      if (active && visible && !pausedForHeavyLayer) {
        gl.uniform1f(uTime, (now - t0) * 0.001)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // Pause when the browser tab is hidden
    const onVisibility = () => { visible = !document.hidden }
    document.addEventListener('visibilitychange', onVisibility)

    // Pause when the canvas is scrolled out of the viewport
    const io = new IntersectionObserver(([e]) => { active = e.isIntersecting }, { threshold: 0 })
    io.observe(canvas)

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
      gl.deleteProgram(prog)
      gl.deleteBuffer(vbo)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="aurora-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  )
}
