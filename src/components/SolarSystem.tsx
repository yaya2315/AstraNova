'use client'

import { Suspense, useRef, useState, useMemo, useCallback, useEffect, memo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'
import { planets, type PlanetData } from '@/lib/data'
import { withBasePath } from '@/lib/basePath'
import SystemFlybyView from './SystemFlyby'
import { useDeepNav } from './DeepNavEngine'

const ORBIT_SEGMENTS = 64
const PLANET_SEGMENTS = 48
const DETAIL_SEGMENTS = 48
export const SUN_RADIUS = 2.5

/* ====== SHARED GEOMETRIES ====== */
const _sharedGeo = new Map<string, THREE.BufferGeometry>()
function getSharedSphere(radius: number, seg: number): THREE.SphereGeometry {
  const k = `s_${radius}_${seg}`
  if (!_sharedGeo.has(k)) _sharedGeo.set(k, new THREE.SphereGeometry(radius, seg, seg))
  return _sharedGeo.get(k)! as THREE.SphereGeometry
}

/* ====== TEXTURE LOADING ====== */
const _texLoader = new THREE.TextureLoader()
const _texCache = new Map<string, THREE.Texture>()
export function loadTexture(url: string): THREE.Texture {
  const cached = _texCache.get(url)
  if (cached) return cached
  const tex = _texLoader.load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  _texCache.set(url, tex)
  return tex
}

/* ====== CAPA DE NUBES ======
   Textura procedural (canvas, semilla por nombre de planeta) de manchas suaves
   semi-transparentes — se monta como una esfera apenas más grande que el planeta
   y gira a otra velocidad, dando profundidad atmosférica sin descargar texturas
   nuevas. Solo para planetas con atmósfera densa (no Mercurio ni Marte). */
const _cloudTexCache = new Map<string, THREE.CanvasTexture>()
function getCloudTexture(seed: string): THREE.CanvasTexture {
  const cached = _cloudTexCache.get(seed)
  if (cached) return cached
  const w = 512, h = 256
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  let s = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 7)
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  for (let i = 0; i < 46; i++) {
    const x = rand() * w, y = rand() * h
    const r = 16 + rand() * 50
    const a = 0.06 + rand() * 0.2
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  _cloudTexCache.set(seed, tex)
  return tex
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
export const Sun = memo(function Sun() {
  const ref      = useRef<THREE.Mesh>(null!)
  const glowRef  = useRef<THREE.Sprite>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)
  const eruptT   = useRef(0)
  const [erupting, setErupting] = useState(false)

  const texture = useMemo(() => loadTexture(withBasePath('/textures/8k_sun.jpg')), [])

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
        geometry={getSharedSphere(SUN_RADIUS, PLANET_SEGMENTS)}
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

/* ====== ÓRBITA ======
   Elipse CENTRADA en el Sol (no con el Sol en el foco): r(θ) = a·b / √(b²cos²θ + a²sin²θ),
   con a = data.orbit (semieje mayor) y b = a√(1-e²) (semieje menor). Mantiene la forma
   elíptica real de cada planeta (Mercurio se nota más achatado que Venus) pero sin el
   corrimiento hacia un foco — el anillo dibujado en OrbitPaths queda perfectamente
   centrado en el Sol, coincidiendo siempre con el camino real del planeta. */
export function orbitRadiusAt(data: PlanetData, theta: number): number {
  const e = data.eccentricity
  const a = data.orbit
  const b = a * Math.sqrt(1 - e * e)
  return (a * b) / Math.sqrt(b * b * Math.cos(theta) ** 2 + a * a * Math.sin(theta) ** 2)
}

/* ====== PLANET ====== */
export function Planet({ data, speedMul, onHover, onLeave, onClick, registerRef }: {
  data: PlanetData; speedMul: number
  onHover: (d: PlanetData) => void; onLeave: () => void; onClick: (d: PlanetData) => void
  registerRef: (name: string, obj: THREE.Object3D | null) => void
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const meshRef = useRef<THREE.Mesh>(null!)
  const cloudRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  const texture = useMemo(() => loadTexture(data.textureUrl), [data.textureUrl])
  const emissiveColor = useMemo(() => new THREE.Color(data.color), [data.color])
  const mainGeo = useMemo(() => getSharedSphere(data.size, PLANET_SEGMENTS), [data.size])
  const rimGeo = useMemo(() => getSharedSphere(data.size, 16), [data.size])
  // Hitbox de click más grande que el mesh visible — sin esto, planetas chicos
  // (Mercurio) son casi imposibles de acertar con el mouse/dedo.
  const hitboxGeo = useMemo(() => getSharedSphere(Math.max(data.size * 1.8, 0.55), 12), [data.size])
  // Nubes: solo planetas con atmósfera densa — Mercurio y Marte se quedan sin ellas.
  const hasClouds = data.name !== 'Mercurio' && data.name !== 'Marte'
  const cloudGeo = useMemo(() => hasClouds ? getSharedSphere(data.size * 1.025, PLANET_SEGMENTS) : null, [hasClouds, data.size])
  const cloudTex = useMemo(() => hasClouds ? getCloudTexture(data.name) : null, [hasClouds, data.name])

  // Registra el group en un Map compartido (Scene) para que la cámara pueda
  // "perseguir" la posición real del planeta cuadro a cuadro (ver CameraFlyTo).
  useEffect(() => {
    registerRef(data.name, groupRef.current)
    return () => registerRef(data.name, null)
  }, [data.name, registerRef])

  const accTime = useRef(data.offset)
  useFrame((_, delta) => {
    accTime.current += delta * data.speed * speedMul
    const theta = accTime.current
    const r = orbitRadiusAt(data, theta)
    groupRef.current.position.x = Math.cos(theta) * r
    groupRef.current.position.z = Math.sin(theta) * r
    meshRef.current.rotation.y += 0.005 * speedMul
    if (cloudRef.current) cloudRef.current.rotation.y += 0.011 * speedMul
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
      {/* Hitbox invisible: capta el raycast de hover/click, más generoso que el mesh visible */}
      <mesh geometry={hitboxGeo} onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick} visible={false} />
      <mesh ref={meshRef} geometry={mainGeo} scale={hovered ? 1.2 : 1}>
        <meshStandardMaterial
          map={texture}
          roughness={data.orbit < 20 ? 0.85 : 0.55}
          metalness={0.05}
          emissive={emissiveColor}
          emissiveIntensity={hovered ? 0.25 : 0.08}
        />
      </mesh>
      {hasClouds && cloudGeo && cloudTex && (
        <mesh ref={cloudRef} geometry={cloudGeo}>
          <meshStandardMaterial map={cloudTex} transparent opacity={0.5} depthWrite={false} roughness={1} />
        </mesh>
      )}
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
export const SaturnRings = memo(function SaturnRings({ size }: { size: number }) {
  const innerR = size * 1.3, outerR = size * 2.4
  const ringTex = useMemo(() => loadTexture(withBasePath('/textures/8k_saturn_ring_alpha.jpg')), [])

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

/* ====== ORBIT PATHS (single instanced draw) ======
   Un solo tono, sutil — como en una lámina de referencia clásica del sistema
   solar: se nota la forma de cada órbita, sin que el color compita con los
   planetas ni con el fondo. */
export const OrbitPaths = memo(function OrbitPaths() {
  const geo = useMemo(() => {
    const allVerts: number[] = []
    for (const p of planets) {
      for (let i = 0; i < ORBIT_SEGMENTS; i++) {
        const a1 = (i / ORBIT_SEGMENTS) * Math.PI * 2
        const a2 = ((i + 1) / ORBIT_SEGMENTS) * Math.PI * 2
        const r1 = orbitRadiusAt(p, a1), r2 = orbitRadiusAt(p, a2)
        allVerts.push(Math.cos(a1) * r1, 0, Math.sin(a1) * r1)
        allVerts.push(Math.cos(a2) * r2, 0, Math.sin(a2) * r2)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3))
    return g
  }, [])

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#9db4d1" transparent opacity={0.25} />
    </lineSegments>
  )
})

/* ====== ASTEROID BELT ====== */
export const AsteroidBelt = memo(function AsteroidBelt() {
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

/* ====== COMETAS ======
   Órbitas muy excéntricas (elipse centrada, mismo principio que orbitRadiusAt
   pero con e alto) inclinadas respecto al plano de la eclíptica — se acercan
   rápido al Sol y se alejan despacio, como un cometa real (velocidad angular
   ∝ 1/r en vez de constante). Cada uno arrastra una cola de puntos que se
   desvanecen, muestreando su propio historial de posiciones recientes. */
function makeGlowTexture(r: number, g: number, b: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64
  const ctx = c.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.5)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

type CometDef = { a: number; e: number; speed: number; tilt: number; offset: number; rgb: [number, number, number] }
const COMET_DEFS: CometDef[] = [
  { a: 34, e: 0.90, speed: 5.5, tilt: 0.35, offset: 0.0, rgb: [200, 230, 255] },
  { a: 42, e: 0.86, speed: 6.5, tilt: -0.5, offset: 2.4, rgb: [220, 245, 255] },
  { a: 26, e: 0.93, speed: 4.2, tilt: 0.6, offset: 4.6, rgb: [235, 250, 255] },
]
const COMET_TAIL_LEN = 9

function Comet({ def }: { def: CometDef }) {
  const coreRef = useRef<THREE.Sprite>(null!)
  const tailRefs = useRef<(THREE.Sprite | null)[]>([])
  const theta = useRef(def.offset)
  const history = useRef(Array.from({ length: COMET_TAIL_LEN }, () => new THREE.Vector3()))
  const b = useMemo(() => def.a * Math.sqrt(1 - def.e * def.e), [def.a, def.e])

  const coreTex = useMemo(() => makeGlowTexture(255, 255, 255), [])
  const tailTex = useMemo(() => makeGlowTexture(...def.rgb), [def.rgb])

  useFrame((_, delta) => {
    const t = theta.current
    const r = (def.a * b) / Math.sqrt(b * b * Math.cos(t) ** 2 + def.a * def.a * Math.sin(t) ** 2)
    theta.current += (def.speed / r) * delta

    // Órbita plana (x', z') inclinada un ángulo fijo respecto a la eclíptica.
    const xFlat = Math.cos(t) * r
    const zFlat = Math.sin(t) * r
    const x = xFlat
    const y = zFlat * Math.sin(def.tilt)
    const z = zFlat * Math.cos(def.tilt)

    coreRef.current.position.set(x, y, z)
    for (let i = history.current.length - 1; i > 0; i--) history.current[i].copy(history.current[i - 1])
    history.current[0].set(x, y, z)
    tailRefs.current.forEach((s, i) => { if (s) s.position.copy(history.current[i]) })
  })

  return (
    <>
      <sprite ref={coreRef} scale={[0.45, 0.45, 1]}>
        <spriteMaterial map={coreTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {Array.from({ length: COMET_TAIL_LEN }).map((_, i) => {
        const f = 1 - i / COMET_TAIL_LEN
        return (
          <sprite key={i} ref={(el) => { tailRefs.current[i] = el }} scale={[0.4 * f, 0.4 * f, 1]}>
            <spriteMaterial map={tailTex} transparent opacity={0.5 * f} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        )
      })}
    </>
  )
}

export const Comets = memo(function Comets() {
  return <>{COMET_DEFS.map((def, i) => <Comet key={i} def={def} />)}</>
})

/* ====== TRANSICIÓN DE CÁMARA — "volar" hacia el planeta clickeado ======
   No usa una animación de un solo tiro: cada cuadro, amortigua (THREE.MathUtils.damp,
   sin dependencias nuevas tipo GSAP/Tween) el `target` de OrbitControls y la posición
   de la cámara hacia la posición ACTUAL del planeta (que sigue orbitando), leída del
   Map de refs que registra cada <Planet>. Así la cámara persigue correctamente incluso
   mientras el planeta se mueve durante la transición. */
const FLY_LAMBDA = 3.2 // suavizado — más alto = llega más rápido

function CameraFlyTo({ controlsRef, planetRefs, flyTarget }: {
  controlsRef: React.RefObject<any>
  planetRefs: React.RefObject<Map<string, THREE.Object3D>>
  flyTarget: string | null
}) {
  const { camera } = useThree()
  const targetPlanet = flyTarget ? planets.find(p => p.name === flyTarget) : null

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return
    const obj = flyTarget ? planetRefs.current?.get(flyTarget) : null
    const focus = obj ? obj.position : new THREE.Vector3(0, 0, 0)

    controls.target.x = THREE.MathUtils.damp(controls.target.x, focus.x, FLY_LAMBDA, delta)
    controls.target.y = THREE.MathUtils.damp(controls.target.y, focus.y, FLY_LAMBDA, delta)
    controls.target.z = THREE.MathUtils.damp(controls.target.z, focus.z, FLY_LAMBDA, delta)

    // Distancia deseada a la cámara: más cerca para planetas chicos, con aire
    // suficiente para no atravesar la geometría (colisión por distancia mínima).
    const desiredDistance = obj && targetPlanet
      ? Math.max(targetPlanet.size * 5.5 + 2.5, 4)
      : 62 // distancia "de conjunto" cuando no hay planeta seleccionado (vuelve al Sol)

    const dir = camera.position.clone().sub(controls.target).normalize()
    if (dir.lengthSq() === 0) dir.set(0, 0.4, 1).normalize()
    const desiredPos = focus.clone().addScaledVector(dir, desiredDistance)

    camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredPos.x, FLY_LAMBDA, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredPos.y, FLY_LAMBDA, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredPos.z, FLY_LAMBDA, delta)

    controls.update()
  })

  return null
}

/* ====== SCENE ====== */
function Scene({ speedMul, onPlanetHover, onPlanetLeave, onPlanetClick, flyTarget }: {
  speedMul: number; onPlanetHover: (d: PlanetData) => void; onPlanetLeave: () => void; onPlanetClick: (d: PlanetData) => void
  flyTarget: string | null
}) {
  const planetRefs = useRef(new Map<string, THREE.Object3D>())
  const controlsRef = useRef<any>(null)
  const registerRef = useCallback((name: string, obj: THREE.Object3D | null) => {
    if (obj) planetRefs.current.set(name, obj)
    else planetRefs.current.delete(name)
  }, [])

  return (
    <>
      <ambientLight intensity={0.5} color="#334466" />
      <directionalLight position={[-15, 5, -20]} intensity={0.6} color="#6680cc" />
      <Stars radius={180} depth={80} count={1800} factor={3} saturation={0} />
      <Sun />
      {planets.map((p) => (
        <Planet key={p.name} data={p} speedMul={speedMul} onHover={onPlanetHover} onLeave={onPlanetLeave}
          onClick={onPlanetClick} registerRef={registerRef} />
      ))}
      <OrbitPaths />
      <AsteroidBelt />
      <Comets />
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.06} enableZoom={false}
        enablePan={false} maxPolarAngle={Math.PI * 0.48} minPolarAngle={Math.PI * 0.1} />
      <CameraFlyTo controlsRef={controlsRef} planetRefs={planetRefs} flyTarget={flyTarget} />
    </>
  )
}

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
          <div className="w-full lg:w-[320px] aspect-square rounded-2xl overflow-hidden flex-shrink-0 bg-space-900/50 border border-white/5">
            <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[0.75, 1.25]}
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

            <div className="grid grid-cols-2 gap-3">
              {planet.stats.map((s) => (
                <div key={s.label} className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                  <div className="font-display text-sm font-bold text-white">{s.value}</div>
                  <div className="text-[0.65rem] text-slate-400 mt-0.5">{s.label}</div>
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
  const texture = useMemo(() => loadTexture(data.textureUrl), [data.textureUrl])
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
  const { depth } = useDeepNav()
  const containerRef = useRef<HTMLDivElement>(null!)
  const [hovered, setHovered] = useState<PlanetData | null>(null)
  const [selected, setSelected] = useState<PlanetData | null>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const [, forceTooltip] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [immersive, setImmersive] = useState(false)
  const [flying, setFlying] = useState(false)
  const [flyTarget, setFlyTarget] = useState<string | null>(null)
  const flyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // No usa la Fullscreen API del navegador (`requestFullscreen`): falla en
  // silencio dentro de iframes sin permiso, en Safari de iOS, o detrás de
  // políticas de features restringidas — el botón "quedaba sin hacer nada".
  // En cambio, arma el mismo overlay a pantalla completa vía CSS + portal a
  // document.body que ya usa SystemFlybyView, así siempre funciona.
  const toggleImmersive = useCallback(() => setImmersive(v => !v), [])

  useEffect(() => () => { if (flyTimeoutRef.current) clearTimeout(flyTimeoutRef.current) }, [])

  // Click desde la vista orbital, o Prev/Next dentro del panel: primero "vuela"
  // la cámara hacia el planeta y, recién al llegar (ARRIVAL_MS, sincronizado con
  // FLY_LAMBDA), actualiza el panel de info — si no, el contenido cambia antes
  // de que la cámara termine de moverse. Prev/Next parte de `flyTarget` (el
  // destino actual, no lo que el panel todavía está mostrando) para que clicks
  // rápidos y consecutivos sigan avanzando planeta por planeta en vez de quedar
  // pegados en el mismo vecino.
  const ARRIVAL_MS = 900
  const handleClick = useCallback((d: PlanetData) => {
    setFlyTarget(d.name)
    if (flyTimeoutRef.current) clearTimeout(flyTimeoutRef.current)
    flyTimeoutRef.current = setTimeout(() => { setSelected(d); flyTimeoutRef.current = null }, ARRIVAL_MS)
  }, [])

  const navigate = useCallback((dir: number) => {
    const fromName = flyTarget ?? selected?.name
    if (!fromName) return
    const idx = planets.findIndex(p => p.name === fromName)
    const next = planets[(idx + dir + planets.length) % planets.length]
    setFlyTarget(next.name)
    if (flyTimeoutRef.current) clearTimeout(flyTimeoutRef.current)
    flyTimeoutRef.current = setTimeout(() => { setSelected(next); flyTimeoutRef.current = null }, ARRIVAL_MS)
  }, [flyTarget, selected])

  const handleHover = useCallback((d: PlanetData) => setHovered(d), [])
  const handleLeave = useCallback(() => setHovered(null), [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    mouseRef.current.x = e.clientX
    mouseRef.current.y = e.clientY
    forceTooltip(c => c + 1)
  }, [])

  const view = (
    <div ref={containerRef} className={immersive
      ? 'fixed inset-0 z-[1000] w-screen h-screen bg-space-950 overflow-hidden'
      : 'relative w-full rounded-2xl overflow-hidden border border-white/[0.04] bg-space-950 h-[440px] sm:h-[560px] md:h-[680px] lg:h-[800px]'
    }>

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

      {/* Se desmonta por completo mientras se vuela (PlanetFlybyView cubre toda la
          pantalla igual): evita tener 2 contextos WebGL activos a la vez, que en
          hardware/navegadores limitados puede agotar el cupo de contextos del
          navegador y perder uno de los dos (pantalla negra). Al volver, `flyTarget`
          vive en el padre y sigue intacto, así que la cámara vuelve a enfocar el
          mismo planeta apenas se remonta — no se pierde el lugar donde estabas. */}
      {!flying && (
        <Canvas camera={{ position: [0, 30, 55], fov: 50 }} dpr={[0.75, 1.25]} frameloop={depth === 1 ? 'always' : 'never'}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, powerPreference: 'high-performance' }}
          onPointerMove={handlePointerMove}>
          <Suspense fallback={null}>
            <Scene speedMul={speed} onPlanetHover={handleHover} onPlanetLeave={handleLeave}
              onPlanetClick={handleClick} flyTarget={flyTarget} />
          </Suspense>
        </Canvas>
      )}

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

      {selected && !flying && (
        <PlanetDetailPanel planet={selected} onClose={() => { setSelected(null); setFlyTarget(null) }}
          onPrev={() => navigate(-1)} onNext={() => navigate(1)} />
      )}

      {/* Pilotear nave — un solo modo de vuelo libre por TODO el sistema, no atado
          a ningún planeta en particular (independiente de `selected`). */}
      {!flying && (
        <button onClick={() => setFlying(true)}
          className="absolute bottom-5 right-4 z-20 flex items-center gap-2 glass rounded-full px-3 sm:px-4 py-2 text-accent-cyan hover:brightness-125 transition-all border border-accent-cyan/20">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          </svg>
          <span className="hidden sm:inline font-display text-[0.6rem] tracking-[2px] whitespace-nowrap">PILOTEAR NAVE</span>
        </button>
      )}

      {flying && <SystemFlybyView onExit={() => setFlying(false)} />}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 font-display text-[0.55rem] tracking-[3px] text-slate-600 flex items-center gap-2.5 z-10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="animate-[dragHint_2s_ease-in-out_infinite]">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
        ARRASTRA PARA GIRAR — CLICK EN PLANETA PARA INFO
      </div>
    </div>
  )

  return view
}
