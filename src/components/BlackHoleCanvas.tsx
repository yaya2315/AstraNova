'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// ── Disk shader ───────────────────────────────────────────────────────────────

const DISK_VERT = `
varying vec2 vDisk;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vDisk = vec2(atan(w.z, w.x), length(w.xz));
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const DISK_FRAG = `
precision highp float;
uniform float uTime;
uniform float uOpacity;
varying vec2 vDisk;

const vec3  WH = vec3(1.000, 0.960, 0.880);
const vec3  GO = vec3(0.788, 0.659, 0.298);
const vec3  MA = vec3(0.851, 0.275, 0.937);
const vec3  VI = vec3(0.486, 0.227, 0.929);
const vec3  TE = vec3(0.000, 0.831, 1.000);
const float R_IN  = 1.04;
const float R_OUT = 3.10;

float h2(vec2 p){ p=fract(p*vec2(127.1,311.7)); p+=dot(p,p+74.5); return fract(p.x*p.y); }
float ns(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int k=0;k<4;k++){v+=a*ns(p);p=p*2.1+vec2(3.7,9.2);a*=0.5;} return v; }

vec3 dCol(float t, float beam) {
  vec3 c;
  if(t<.18)      c=mix(WH,GO,t/.18);
  else if(t<.48) c=mix(GO,MA,(t-.18)/.30);
  else if(t<.76) c=mix(MA,VI,(t-.48)/.28);
  else            c=mix(VI,TE,(t-.76)/.24);
  float b=clamp((beam-1.0)/3.5,-1.0,1.0);
  if(b>0.0) c=mix(c,WH,b*.50); else c=mix(c,MA,-b*.35);
  return c;
}

void main() {
  float dR  = vDisk.y;
  float ang = vDisk.x;
  if(dR < R_IN || dR > R_OUT) discard;

  float t     = (dR - R_IN) / (R_OUT - R_IN);
  float omega = pow(dR, -1.5) * 5.0;
  float fase  = ang + uTime * omega * 0.28;
  float beam  = clamp(1.0 + 3.8 * (-sin(ang)), 0.04, 6.0);
  vec3  col   = dCol(t, beam);
  float turb  = fbm(vec2(fase * 2.8, t * 5.5) + uTime * 0.04);
  col *= 0.50 + turb * 1.00;

  float brill = (1.40 - t * 0.80) * beam;
  float fIn   = smoothstep(R_IN,  R_IN  + 0.18, dR);
  float fOut  = smoothstep(R_OUT, R_OUT - 0.50, dR);
  float alfa  = fIn * fOut * brill * 0.85 * uOpacity;

  col = col / (1.0 + col);
  col = pow(max(col, 0.0), vec3(1.0/2.2));
  gl_FragColor = vec4(col, clamp(alfa, 0.0, 1.0));
}
`

// ── Photon ring shader ────────────────────────────────────────────────────────

const RING_VERT = `
varying float vAng;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vAng = atan(w.z, w.x);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const RING_FRAG = `
precision highp float;
varying float vAng;
const vec3 WH = vec3(1.0,  0.96, 0.88);
const vec3 GO = vec3(0.788, 0.659, 0.298);
const vec3 MA = vec3(0.851, 0.275, 0.937);
void main() {
  float beam = clamp(1.0 + 3.8 * (-sin(vAng)), 0.04, 6.0);
  float t    = clamp((beam - 1.0) / 5.0, 0.0, 1.0);
  vec3  col  = mix(MA, mix(GO, WH, t), t * 0.85);
  col *= beam * 0.5;
  col  = col / (1.0 + col);
  col  = pow(max(col, 0.0), vec3(1.0/2.2));
  gl_FragColor = vec4(col, clamp(beam * 0.65, 0.0, 1.0));
}
`

// ── Component ─────────────────────────────────────────────────────────────────

export function BlackHoleCanvas({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reducida = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(dpr)
    renderer.setClearColor(0x000000, 0)
    renderer.autoClear = false

    // ── Scene & Camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(0, 1.3, 5.5)
    camera.lookAt(0, 0, 0)

    // ── Disk material factory ─────────────────────────────────────────────────
    function makeDiskMat(opacity: number) {
      return new THREE.ShaderMaterial({
        vertexShader: DISK_VERT,
        fragmentShader: DISK_FRAG,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: opacity } },
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      })
    }

    // ── Geometries & meshes ───────────────────────────────────────────────────
    const ROT_X = -Math.PI / 2

    // Event horizon sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    )
    scene.add(sphere)

    // Violet rim glow (BackSide sphere, slightly larger)
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.486, 0.227, 0.929),
      transparent: true,
      opacity: 0.10,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.78, 32, 32), glowMat))

    // Main flat disk
    const diskMat0 = makeDiskMat(1.0)
    const diskMesh0 = new THREE.Mesh(new THREE.RingGeometry(1.04, 3.1, 256, 1), diskMat0)
    diskMesh0.rotation.x = ROT_X
    scene.add(diskMesh0)

    // Haze layers — tilted ±6° to simulate disk thickness
    const diskMat1 = makeDiskMat(0.22)
    const diskMesh1 = new THREE.Mesh(new THREE.RingGeometry(1.04, 3.1, 128, 1), diskMat1)
    diskMesh1.rotation.x = ROT_X + 0.10
    scene.add(diskMesh1)

    const diskMat2 = makeDiskMat(0.22)
    const diskMesh2 = new THREE.Mesh(new THREE.RingGeometry(1.04, 3.1, 128, 1), diskMat2)
    diskMesh2.rotation.x = ROT_X - 0.10
    scene.add(diskMesh2)

    // Photon ring (torus, horizontal)
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      uniforms: {},
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    })
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.912, 0.024, 16, 256), ringMat)
    ringMesh.rotation.x = ROT_X
    scene.add(ringMesh)

    // ── Resize ────────────────────────────────────────────────────────────────
    // Pass CSS dimensions to setSize; Three.js multiplies by pixelRatio internally
    function ajustar() {
      const rect = canvas!.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      if (w > 0 && h > 0) {
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    let rafId: number | null = null
    let pausado = false
    const t0 = performance.now()

    function renderizar(ts: number) {
      const t = (ts - t0) * 0.001
      ajustar()
      diskMat0.uniforms.uTime.value = t
      diskMat1.uniforms.uTime.value = t
      diskMat2.uniforms.uTime.value = t
      renderer.clear()
      renderer.render(scene, camera)
      if (!reducida) rafId = requestAnimationFrame(renderizar)
    }

    ajustar()

    if (reducida) {
      diskMat0.uniforms.uTime.value = 2.8
      diskMat1.uniforms.uTime.value = 2.8
      diskMat2.uniforms.uTime.value = 2.8
      renderer.clear()
      renderer.render(scene, camera)
    } else {
      rafId = requestAnimationFrame(renderizar)
    }

    // Pause when off-screen
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (pausado && !reducida) { pausado = false; rafId = requestAnimationFrame(renderizar) }
      } else {
        pausado = true
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
      }
    }, { threshold: 0.05 })
    observer.observe(canvas)

    const ro = new ResizeObserver(ajustar)
    ro.observe(canvas)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer.disconnect()
      ro.disconnect()
      renderer.dispose()
    }
  }, [])

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        role="presentation"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
