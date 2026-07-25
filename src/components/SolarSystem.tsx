'use client'

import { Suspense, useRef, useState, useMemo, useCallback, useEffect, memo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'
import { planets, type PlanetData } from '@/lib/data'

const ORBIT_SEGMENTS = 64
const PLANET_SEGMENTS = 32
const DETAIL_SEGMENTS = 48

/* ====== SHARED GEOMETRIES ====== */
const _sharedGeo = new Map<string, THREE.BufferGeometry>()
function getSharedSphere(radius: number, seg: number): THREE.SphereGeometry {
  const k = `s_${radius}_${seg}`
  if (!_sharedGeo.has(k)) _sharedGeo.set(k, new THREE.SphereGeometry(radius, seg, seg))
  return _sharedGeo.get(k)! as THREE.SphereGeometry
}

/* ====== PROCEDURAL TEXTURES ======
   No hay assets de imagen en /public, así que las texturas de planetas, sol
   y anillos se generan en canvas (mismo enfoque que ya usaba la Luna). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function shade(hex: string, amt: number): string {
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(hex).getHSL(hsl)
  const l = Math.max(0, Math.min(1, hsl.l + amt))
  return `#${new THREE.Color().setHSL(hsl.h, hsl.s, l).getHexString()}`
}

const _planetTex = new Map<string, THREE.CanvasTexture>()
function getPlanetTexture(data: PlanetData): THREE.CanvasTexture {
  const cached = _planetTex.get(data.name)
  if (cached) return cached

  const w = 1024, h = 512
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const rand = mulberry32(hashSeed(data.name))
  const base = data.color
  const isGasOrIce = data.type.includes('GASEOSO') || data.type.includes('HIELO')

  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  if (data.name === 'Tierra') {
    ctx.fillStyle = '#1c5faa'; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 10; i++) {
      const cx = rand() * w, cy = h * 0.18 + rand() * h * 0.64
      const rw = 60 + rand() * 170, rh = 40 + rand() * 100
      ctx.fillStyle = rand() > 0.35 ? '#2e7d4f' : '#8a7a4f'
      ctx.beginPath(); ctx.ellipse(cx, cy, rw, rh, rand() * Math.PI, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 0.18
    for (let i = 0; i < 40; i++) {
      const x = rand() * w, y = rand() * h, r = rand() * 50 + 20
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillRect(0, 0, w, h * 0.06); ctx.fillRect(0, h * 0.94, w, h * 0.06)
  } else if (isGasOrIce) {
    const bands = data.type.includes('GASEOSO') ? 14 : 8
    for (let b = 0; b < bands; b++) {
      ctx.fillStyle = shade(base, (rand() - 0.5) * 0.18)
      ctx.globalAlpha = 0.55
      ctx.fillRect(0, (b / bands) * h, w, h / bands)
    }
    ctx.globalAlpha = 0.08
    for (let i = 0; i < 1500; i++) {
      const x = rand() * w, y = rand() * h, r = rand() * 30 + 4
      ctx.fillStyle = shade(base, (rand() - 0.5) * 0.25)
      ctx.beginPath(); ctx.ellipse(x, y, r * 2, r * 0.4, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    if (data.name === 'Júpiter') {
      const g = ctx.createRadialGradient(w * 0.62, h * 0.55, 0, w * 0.62, h * 0.55, 60)
      g.addColorStop(0, 'rgba(180,70,40,0.85)'); g.addColorStop(1, 'rgba(180,70,40,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.ellipse(w * 0.62, h * 0.55, 55, 28, 0, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    // rocosos: superficie craterizada tintada con el color del planeta
    for (let i = 0; i < 140; i++) {
      const cx = rand() * w, cy = rand() * h, r = rand() * 18 + 3
      const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r)
      g.addColorStop(0, shade(base, 0.15)); g.addColorStop(0.6, shade(base, -0.05)); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalAlpha = 0.5
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  const img = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 14
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  _planetTex.set(data.name, tex)
  return tex
}

let _sunTex: THREE.CanvasTexture | null = null
function getSunTexture(): THREE.CanvasTexture {
  if (_sunTex) return _sunTex
  const w = 1024, h = 512
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const rand = mulberry32(7)
  ctx.fillStyle = '#ff9d2e'; ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 400; i++) {
    const x = rand() * w, y = rand() * h, r = rand() * 50 + 10
    const light = rand() > 0.5
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, light ? 'rgba(255,240,180,0.5)' : 'rgba(200,60,0,0.4)')
    g.addColorStop(1, 'rgba(255,157,46,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  const img = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 20
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.7))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.3))
  }
  ctx.putImageData(img, 0, 0)
  _sunTex = new THREE.CanvasTexture(c)
  _sunTex.colorSpace = THREE.SRGBColorSpace
  return _sunTex
}

let _ringTex: THREE.CanvasTexture | null = null
function getRingAlphaTexture(): THREE.CanvasTexture {
  if (_ringTex) return _ringTex
  const w = 512, h = 16
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const rand = mulberry32(42)
  for (let x = 0; x < w; x++) {
    const t = x / w
    let v = Math.sin(t * Math.PI) * 200 + (rand() - 0.5) * 40
    if (t > 0.55 && t < 0.6) v *= 0.15
    if (t > 0.75 && t < 0.78) v *= 0.4
    v = Math.max(0, Math.min(255, v))
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(x, 0, 1, h)
  }
  _ringTex = new THREE.CanvasTexture(c)
  return _ringTex
}

/* ====== SOLAR ERUPTION PARTICLES ====== */
const N_PLASMA = 30

interface PlasmaP { pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number }

function SolarEruption({ active }: { active: boolean }) {
  const spriteRefs = useRef<(THREE.Sprite | null)[]>([])
  const particles = useRef<PlasmaP[]>([])

  const dotTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0,    'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,220,100,0.9)')
    g.addColorStop(0.65, 'rgba(255,90,0,0.4)')
    g.addColorStop(1,    'rgba(255,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  }, [])

  useEffect(() => {
    if (!active) return
    particles.current = Array.from({ length: N_PLASMA }, () => {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const nx = Math.sin(phi) * Math.cos(theta)
      const ny = Math.sin(phi) * Math.sin(theta)
      const nz = Math.cos(phi)
      const pos = new THREE.Vector3(nx * 2.56, ny * 2.56, nz * 2.56)
      const spd = Math.random() * 2.8 + 1.5
      const vel = new THREE.Vector3(
        nx * spd + (Math.random() - 0.5) * 1.6,
        ny * spd + (Math.random() - 0.5) * 1.6,
        nz * spd + (Math.random() - 0.5) * 1.6,
      )
      return { pos, vel, age: -(Math.random() * 0.38), life: Math.random() * 0.8 + 0.8 }
    })
  }, [active])

  useFrame((_, delta) => {
    if (!active) return
    particles.current.forEach((p, i) => {
      p.age += delta
      const s = spriteRefs.current[i]
      if (!s) return
      if (p.age < 0 || p.age >= p.life) { s.visible = false; return }

      // solar gravity pulls blobs back in
      p.vel.addScaledVector(p.pos.clone().normalize(), -5.0 * delta)
      p.pos.addScaledVector(p.vel, delta)

      const t = p.age / p.life
      s.visible = true
      s.position.copy(p.pos)

      const sz = 0.72 * (t < 0.18 ? t / 0.18 : 1 - (t - 0.18) / 0.82)
      s.scale.setScalar(Math.max(0.01, sz))

      const mat = s.material as THREE.SpriteMaterial
      mat.color.setHSL(0.07 - t * 0.07, 1.0, 0.92 - t * 0.58)
      mat.opacity = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.88)
    })
  })

  return (
    <group>
      {Array.from({ length: N_PLASMA }, (_, i) => (
        <sprite key={i} ref={(el: THREE.Sprite | null) => { spriteRefs.current[i] = el }} visible={false}>
          <spriteMaterial map={dotTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} color="white" opacity={0} />
        </sprite>
      ))}
    </group>
  )
}

/* ====== SUN ====== */
const Sun = memo(function Sun() {
  const ref      = useRef<THREE.Mesh>(null!)
  const glowRef  = useRef<THREE.Sprite>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)
  const eruptT   = useRef(0)
  const [erupting, setErupting] = useState(false)

  const texture = useMemo(() => getSunTexture(), [])

  const glowTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0,   'rgba(255,220,80,0.5)')
    g.addColorStop(0.3, 'rgba(255,160,20,0.2)')
    g.addColorStop(1,   'rgba(255,80,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])

  useFrame((state, delta) => {
    ref.current.rotation.y += 0.002
    const breathe = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02

    if (erupting) {
      eruptT.current += delta
      const t = Math.min(eruptT.current / 2.2, 1)
      // burst envelope: 0→1 in first 20%, then decays back to 0
      const burst = t < 0.2 ? t / 0.2 : Math.pow(1 - (t - 0.2) / 0.8, 2)

      ref.current.scale.setScalar(breathe * (1 + burst * 0.6))
      const g = 18 + burst * 22
      glowRef.current.scale.set(g, g, 1)
      lightRef.current.intensity = 3 + burst * 24

      if (t >= 1) { setErupting(false); eruptT.current = 0 }
    } else {
      ref.current.scale.setScalar(breathe)
      glowRef.current.scale.set(18, 18, 1)
      lightRef.current.intensity = 3
    }
  })

  return (
    <group>
      <mesh
        ref={ref}
        geometry={getSharedSphere(2.5, PLANET_SEGMENTS)}
        onClick={(e) => { e.stopPropagation(); if (!erupting) { eruptT.current = 0; setErupting(true) } }}
        onPointerOver={() => { document.body.style.cursor = 'crosshair' }}
        onPointerOut={() => { document.body.style.cursor = '' }}
      >
        <meshBasicMaterial map={texture} />
      </mesh>
      <pointLight ref={lightRef} intensity={3} distance={200} decay={0.3} color="#fff0dd" />
      <sprite ref={glowRef} scale={[18, 18, 1]}>
        <spriteMaterial map={glowTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.6} />
      </sprite>
      <SolarEruption active={erupting} />
    </group>
  )
})

/* ====== PLANET ====== */
function Planet({ data, speedMul, onHover, onLeave, onClick }: {
  data: PlanetData; speedMul: number
  onHover: (d: PlanetData) => void; onLeave: () => void; onClick: (d: PlanetData) => void
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  const texture = useMemo(() => getPlanetTexture(data), [data])
  const emissiveColor = useMemo(() => new THREE.Color(data.color), [data.color])
  const mainGeo = useMemo(() => getSharedSphere(data.size, PLANET_SEGMENTS), [data.size])
  const rimGeo = useMemo(() => getSharedSphere(data.size, 16), [data.size])

  const accTime = useRef(data.offset)
  useFrame((_, delta) => {
    accTime.current += delta * data.speed * speedMul
    groupRef.current.position.x = Math.cos(accTime.current) * data.orbit
    groupRef.current.position.z = Math.sin(accTime.current) * data.orbit
    meshRef.current.rotation.y += 0.005 * speedMul
  })

  const handleOver = useCallback((e: any) => {
    e.stopPropagation(); setHovered(true); onHover(data); document.body.style.cursor = 'pointer'
  }, [data, onHover])

  const handleOut = useCallback(() => {
    setHovered(false); onLeave(); document.body.style.cursor = ''
  }, [onLeave])

  const handleClick = useCallback((e: any) => {
    e.stopPropagation(); onClick(data)
  }, [data, onClick])

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={mainGeo} onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}
        scale={hovered ? 1.2 : 1}>
        <meshStandardMaterial
          map={texture}
          roughness={data.orbit < 20 ? 0.85 : 0.55}
          metalness={0.05}
          emissive={emissiveColor}
          emissiveIntensity={hovered ? 0.25 : 0.08}
        />
      </mesh>
      {/* Inner rim — sharp edge light */}
      <mesh geometry={rimGeo} scale={hovered ? 1.22 : 1.1}>
        <meshBasicMaterial color={data.color} transparent opacity={hovered ? 0.35 : 0.15} side={THREE.BackSide} />
      </mesh>
      {/* Outer glow — soft atmospheric halo */}
      <mesh geometry={rimGeo} scale={hovered ? 1.45 : 1.25}>
        <meshBasicMaterial color={data.color} transparent opacity={hovered ? 0.12 : 0.05} side={THREE.BackSide} />
      </mesh>
      {hovered && (
        <Html distanceFactor={15} center style={{ pointerEvents: 'none' }}>
          <div className="px-4 py-1.5 rounded-full glass-strong text-accent-cyan text-[0.6rem] font-display tracking-[3px] whitespace-nowrap shadow-lg shadow-accent-purple/10 border border-accent-purple/20">
            {data.name.toUpperCase()}
          </div>
        </Html>
      )}
      {data.rings && <SaturnRings size={data.size} />}
      {data.moon && <Moon moon={data.moon} speedMul={speedMul} />}
    </group>
  )
}

/* ====== SATURN RINGS ====== */
const SaturnRings = memo(function SaturnRings({ size }: { size: number }) {
  const innerR = size * 1.3, outerR = size * 2.4
  const ringTex = useMemo(() => getRingAlphaTexture(), [])

  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(innerR, outerR, 48)
    const pos = g.attributes.position, uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i)
      uv.setXY(i, (Math.sqrt(x * x + y * y) - innerR) / (outerR - innerR), 0.5)
    }
    return g
  }, [innerR, outerR])

  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2.2, 0, 0]}>
      <meshBasicMaterial color="#d4b888" alphaMap={ringTex} transparent side={THREE.DoubleSide} opacity={0.9} />
    </mesh>
  )
})

/* ====== MOON ====== */
function Moon({ moon, speedMul }: { moon: { size: number; orbit: number; speed: number }; speedMul: number }) {
  const ref = useRef<THREE.Mesh>(null!)
  const geo = useMemo(() => getSharedSphere(moon.size, 24), [moon.size])
  const accTime = useRef(0)

  const texture = useMemo(() => {
    const w = 512, h = 256
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d')!
    // Base highland grey
    ctx.fillStyle = '#b8b4ae'; ctx.fillRect(0, 0, w, h)
    // Mare (dark flat regions)
    const maria = [
      [0.22, 0.38, 0.18, 0.12], [0.34, 0.42, 0.10, 0.08],
      [0.56, 0.35, 0.12, 0.09], [0.44, 0.52, 0.08, 0.06],
      [0.70, 0.48, 0.09, 0.07],
    ]
    for (const [mx, my, rx, ry] of maria) {
      const gx = ctx.createRadialGradient(mx*w, my*h, 0, mx*w, my*h, rx*w)
      gx.addColorStop(0, 'rgba(72,70,68,0.72)'); gx.addColorStop(1, 'rgba(72,70,68,0)')
      ctx.fillStyle = gx; ctx.beginPath()
      ctx.ellipse(mx*w, my*h, rx*w, ry*h, 0, 0, Math.PI*2); ctx.fill()
    }
    // Craters — large
    for (let i = 0; i < 60; i++) {
      const cx = Math.random()*w, cy = Math.random()*h, r = Math.random()*14+3
      ctx.beginPath(); ctx.arc(cx+r*0.1, cy+r*0.1, r*1.08, 0, Math.PI*2)
      ctx.fillStyle = 'rgba(50,48,46,0.4)'; ctx.fill()
      const cg = ctx.createRadialGradient(cx-r*0.2, cy-r*0.2, 0, cx, cy, r)
      cg.addColorStop(0, 'rgba(180,176,170,0.6)'); cg.addColorStop(0.6, 'rgba(100,98,94,0.3)'); cg.addColorStop(1, 'rgba(50,48,46,0)')
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2)
      ctx.fillStyle = cg; ctx.fill()
      ctx.beginPath(); ctx.arc(cx-r*0.15, cy-r*0.15, r*0.85, 0, Math.PI*2)
      ctx.strokeStyle = 'rgba(200,196,190,0.3)'; ctx.lineWidth = 0.6; ctx.stroke()
    }
    // Pixel noise for surface texture
    const d = ctx.getImageData(0, 0, w, h)
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (Math.random()-0.5)*22
      d.data[i] = Math.max(0, Math.min(255, d.data[i]+n))
      d.data[i+1] = Math.max(0, Math.min(255, d.data[i+1]+n))
      d.data[i+2] = Math.max(0, Math.min(255, d.data[i+2]+n))
    }
    ctx.putImageData(d, 0, 0)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [])

  useFrame((_, delta) => {
    accTime.current += delta * moon.speed * speedMul
    ref.current.position.x = Math.cos(accTime.current) * moon.orbit
    ref.current.position.z = Math.sin(accTime.current) * moon.orbit
    ref.current.rotation.y += 0.003 * speedMul
  })
  return (
    <mesh ref={ref} geometry={geo}>
      <meshStandardMaterial map={texture} roughness={0.95} metalness={0} emissive="#3a3830" emissiveIntensity={0.08} />
    </mesh>
  )
}

/* ====== ORBIT PATHS (single instanced draw) ====== */
const OrbitPaths = memo(function OrbitPaths() {
  const ref = useRef<THREE.LineSegments>(null!)
  const geo = useMemo(() => {
    const allVerts: number[] = []
    for (const p of planets) {
      for (let i = 0; i < ORBIT_SEGMENTS; i++) {
        const a1 = (i / ORBIT_SEGMENTS) * Math.PI * 2
        const a2 = ((i + 1) / ORBIT_SEGMENTS) * Math.PI * 2
        allVerts.push(Math.cos(a1) * p.orbit, 0, Math.sin(a1) * p.orbit)
        allVerts.push(Math.cos(a2) * p.orbit, 0, Math.sin(a2) * p.orbit)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3))
    return g
  }, [])

  return (
    <lineSegments ref={ref} geometry={geo}>
      <lineBasicMaterial color="#8B5CF6" transparent opacity={0.18} />
    </lineSegments>
  )
})

/* ====== ASTEROID BELT ====== */
const AsteroidBelt = memo(function AsteroidBelt() {
  const positions = useMemo(() => {
    const p = new Float32Array(400 * 3)
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2, r = 19.5 + Math.random() * 2
      p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = (Math.random() - 0.5) * 0.5; p[i * 3 + 2] = Math.sin(a) * r
    }
    return p
  }, [])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#8B8BAA" size={0.06} transparent opacity={0.4} sizeAttenuation />
    </points>
  )
})

/* ====== SCENE ====== */
function Scene({ speedMul, onPlanetHover, onPlanetLeave, onPlanetClick }: {
  speedMul: number; onPlanetHover: (d: PlanetData) => void; onPlanetLeave: () => void; onPlanetClick: (d: PlanetData) => void
}) {
  return (
    <>
      <ambientLight intensity={0.5} color="#334466" />
      <directionalLight position={[-15, 5, -20]} intensity={0.6} color="#6680cc" />
      <Stars radius={180} depth={80} count={3000} factor={3} saturation={0} />
      <Sun />
      {planets.map((p) => (
        <Planet key={p.name} data={p} speedMul={speedMul} onHover={onPlanetHover} onLeave={onPlanetLeave} onClick={onPlanetClick} />
      ))}
      <OrbitPaths />
      <AsteroidBelt />
      <OrbitControls enableDamping dampingFactor={0.06} enableZoom={false}
        enablePan={false} maxPolarAngle={Math.PI * 0.48} minPolarAngle={Math.PI * 0.1} />
    </>
  )
}

/* ====== EXPLORACION VIEW — fullscreen overlay ====== */
/* ====== PLANET DETAIL PANEL ====== */
function PlanetDetailPanel({ planet, onClose, onPrev, onNext }: {
  planet: PlanetData; onClose: () => void; onPrev: () => void; onNext: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-strong rounded-3xl max-w-[900px] w-full max-h-[85vh] overflow-y-auto p-5 sm:p-8 relative"
        onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-accent-purple transition-all z-10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Prev/Next: en móvil van arriba junto al botón de cerrar (no centrados en
            todo el alto scrolleable, donde terminarían tapando la descripción larga
            al hacer scroll); en desktop mantienen la posición centrada original. */}
        <button onClick={onPrev} className="absolute left-4 top-4 lg:top-1/2 lg:-translate-y-1/2 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-accent-purple transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <button onClick={onNext} className="absolute right-16 lg:right-4 top-4 lg:top-1/2 lg:-translate-y-1/2 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-accent-purple transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </button>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="w-full lg:w-[320px] h-[320px] rounded-2xl overflow-hidden flex-shrink-0 bg-space-900/50 border border-white/5">
            <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 1.5]}
              gl={{ antialias: false, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}>
              <ambientLight intensity={0.4} color="#334466" />
              <directionalLight position={[5, 3, 5]} intensity={1.2} color="#fff0dd" />
              <directionalLight position={[-4, 2, -5]} intensity={0.5} color="#6680cc" />
              <PlanetDetailMesh data={planet} />
              <OrbitControls enableZoom enableDamping dampingFactor={0.08} minDistance={2} maxDistance={8} autoRotate autoRotateSpeed={1.5} />
            </Canvas>
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-display text-[0.6rem] tracking-[5px] text-accent-purple uppercase mb-2">
              {planet.type}
            </div>
            <h3 className="font-display text-3xl font-bold mb-3" style={{ color: planet.color }}>
              {planet.name}
            </h3>
            <p className="text-slate-400 leading-relaxed mb-6 text-[0.95rem]">{planet.longDesc}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {planet.stats.map((s) => (
                <div key={s.label} className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                  <div className="font-display text-sm font-bold text-white">{s.value}</div>
                  <div className="text-[0.65rem] text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

function PlanetDetailMesh({ data }: { data: PlanetData }) {
  const ref = useRef<THREE.Mesh>(null!)
  const texture = useMemo(() => getPlanetTexture(data), [data])
  const emissiveColor = useMemo(() => new THREE.Color(data.color), [data.color])
  useFrame(() => { ref.current.rotation.y += 0.004 })
  const scaledSize = Math.min(data.size * 1.8, 2)

  return (
    <group>
      <mesh ref={ref} geometry={getSharedSphere(scaledSize, DETAIL_SEGMENTS)}>
        <meshStandardMaterial map={texture} roughness={0.6} metalness={0.05} emissive={emissiveColor} emissiveIntensity={0.1} />
      </mesh>
      {/* Inner rim */}
      <mesh geometry={getSharedSphere(scaledSize, 16)} scale={1.1}>
        <meshBasicMaterial color={data.color} transparent opacity={0.2} side={THREE.BackSide} />
      </mesh>
      {/* Outer glow */}
      <mesh geometry={getSharedSphere(scaledSize, 16)} scale={1.28}>
        <meshBasicMaterial color={data.color} transparent opacity={0.07} side={THREE.BackSide} />
      </mesh>
      {data.rings && <SaturnRings size={scaledSize} />}
    </group>
  )
}

/* ====== MAIN EXPORT ====== */
export default function SolarSystem() {
  const containerRef = useRef<HTMLDivElement>(null!)
  const [hovered, setHovered] = useState<PlanetData | null>(null)
  const [selected, setSelected] = useState<PlanetData | null>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const [, forceTooltip] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [immersive, setImmersive] = useState(false)

  const toggleImmersive = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setImmersive(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setImmersive(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setImmersive(false) }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const navigate = useCallback((dir: number) => {
    if (!selected) return
    const idx = planets.findIndex(p => p.name === selected.name)
    const next = (idx + dir + planets.length) % planets.length
    setSelected(planets[next])
  }, [selected])

  const handleHover = useCallback((d: PlanetData) => setHovered(d), [])
  const handleLeave = useCallback(() => setHovered(null), [])
  const handleClick = useCallback((d: PlanetData) => setSelected(d), [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    mouseRef.current.x = e.clientX
    mouseRef.current.y = e.clientY
    forceTooltip(c => c + 1)
  }, [])

  return (
    <div ref={containerRef} className={`relative w-full rounded-2xl overflow-hidden border border-white/[0.04] bg-space-950 ${immersive ? 'h-screen' : 'h-[440px] sm:h-[560px] md:h-[680px] lg:h-[800px]'}`}>

      {/* Immersive button — top left. Sin etiqueta de texto en pantallas angostas
          (icono solo) para no chocar con el control de velocidad de la derecha. */}
      <button onClick={toggleImmersive}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 glass rounded-full px-2.5 sm:px-3.5 py-1.5 text-slate-400 hover:text-white transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
          {immersive
            ? <><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></>
            : <><path d="M3 8V5a2 2 0 0 1 2-2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/></>
          }
        </svg>
        <span className="hidden sm:inline font-display text-[0.55rem] tracking-[2px] whitespace-nowrap">{immersive ? 'SALIR' : 'INMERSIVO'}</span>
      </button>

      {/* Speed control — top right. Más compacto en móvil: sin ícono de reloj
          y botones más angostos para no superponerse con el botón inmersivo. */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-0.5 sm:gap-1 glass rounded-full px-1.5 sm:px-3 py-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="hidden sm:block text-accent-purple mr-1 flex-shrink-0">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        {([0.5, 1, 2, 5] as const).map((v, i) => (
          <button key={v} onClick={() => setSpeed(v)}
            className={`font-display text-[0.55rem] tracking-wider px-1.5 sm:px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
              speed === v ? 'bg-accent-purple/20 text-accent-purple' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {['0.5x','1x','2x','5x'][i]}
          </button>
        ))}
      </div>

      <Canvas camera={{ position: [0, 30, 55], fov: 50 }} dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, powerPreference: 'high-performance' }}
        onPointerMove={handlePointerMove}>
        <Suspense fallback={null}>
          <Scene speedMul={speed} onPlanetHover={handleHover} onPlanetLeave={handleLeave}
            onPlanetClick={handleClick} />
        </Suspense>
      </Canvas>

      {hovered && !selected && (
        <div className="fixed z-50 pointer-events-none transition-opacity duration-200"
          style={{ left: Math.min(mouseRef.current.x + 20, typeof window !== 'undefined' ? window.innerWidth - 340 : 9999), top: Math.max(10, mouseRef.current.y - 20) }}>
          <div className="glass-strong rounded-2xl p-5 max-w-[280px] shadow-2xl border border-accent-purple/10">
            <h4 className="font-display text-sm tracking-[2px] mb-1" style={{ color: hovered.color }}>{hovered.name}</h4>
            <div className="font-display text-[0.55rem] tracking-[3px] text-slate-500 mb-2">{hovered.type}</div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">{hovered.desc}</p>
            <div className="text-[0.55rem] text-accent-purple font-display tracking-widest">CLICK PARA EXPLORAR</div>
          </div>
        </div>
      )}

      {selected && (
        <PlanetDetailPanel planet={selected} onClose={() => setSelected(null)}
          onPrev={() => navigate(-1)} onNext={() => navigate(1)} />
      )}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 font-display text-[0.55rem] tracking-[3px] text-slate-600 flex items-center gap-2.5 z-10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="animate-[dragHint_2s_ease-in-out_infinite]">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
        ARRASTRA PARA GIRAR — CLICK EN PLANETA PARA INFO
      </div>
    </div>
  )
}
