'use client'

import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { PlanetData } from '@/lib/data'

const esRocoso = (p: PlanetData) => p.type.includes('ROCOSO')

/* ====== TEXTURA DE TERRENO (canvas → CanvasTexture, mismo enfoque que Moon en SolarSystem.tsx) ====== */
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

function generateTerrainTexture(planet: PlanetData): THREE.CanvasTexture {
  const w = 1024, h = 1024
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const rand = mulberry32(hashSeed(planet.name + '-terrain'))
  const base = planet.color

  ctx.fillStyle = shade(base, -0.1)
  ctx.fillRect(0, 0, w, h)

  if (planet.name === 'Tierra') {
    // Parches de vegetación/tierra sobre una base rocosa
    for (let i = 0; i < 120; i++) {
      const x = rand() * w, y = rand() * h, r = rand() * 60 + 20
      ctx.fillStyle = rand() > 0.4 ? shade('#2e7d4f', (rand() - 0.5) * 0.15) : shade('#6b5a3a', (rand() - 0.5) * 0.15)
      ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, rand() * Math.PI, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  } else if (planet.name === 'Marte') {
    // Polvo rojizo + rocas grandes
    for (let i = 0; i < 60; i++) {
      const x = rand() * w, y = rand() * h, r = rand() * 18 + 6
      ctx.fillStyle = shade(base, (rand() - 0.5) * 0.2 - 0.05)
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, rand() * Math.PI, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = shade(base, -0.35); ctx.lineWidth = 1.5; ctx.stroke()
    }
  }

  // Cráteres (todos los rocosos) — mismo estilo que la Luna
  const craterCount = planet.name === 'Tierra' ? 25 : 90
  for (let i = 0; i < craterCount; i++) {
    const cx = rand() * w, cy = rand() * h, r = rand() * 30 + 5
    ctx.beginPath(); ctx.arc(cx + r * 0.1, cy + r * 0.1, r * 1.08, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill()
    const cg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r)
    cg.addColorStop(0, shade(base, 0.18)); cg.addColorStop(0.6, shade(base, -0.08)); cg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = cg; ctx.fill()
  }

  // Ruido de superficie
  const img = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 18
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(10, 10)
  return tex
}

/* ====== CIELO — gradiente vertical mapeado a una esfera invertida ====== */
function generateSkyTexture(topColor: string, bottomColor: string): THREE.CanvasTexture {
  const w = 16, h = 512
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, topColor); g.addColorStop(1, bottomColor)
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ====== SUELO ROCOSO (Mercurio, Venus, Tierra, Marte) ====== */
function RockyGround({ planet }: { planet: PlanetData }) {
  const groundTex = useMemo(() => generateTerrainTexture(planet), [planet])
  const hasAtmosphere = planet.name !== 'Mercurio'

  const [skyTop, skyBottom, sunColor] = useMemo<[string, string, string]>(() => {
    switch (planet.name) {
      case 'Venus':  return ['#5a4522', '#d9a856', '#fff2c0']
      case 'Tierra': return ['#1b4d8f', '#bfe3f5', '#fff6d8']
      case 'Marte':  return ['#5c2e1e', '#d98a5e', '#ffdcc0']
      default:       return ['#04040a', '#0c0c14', '#e8ecff'] // Mercurio: sin atmósfera
    }
  }, [planet.name])

  const skyTex = useMemo(() => generateSkyTexture(skyTop, skyBottom), [skyTop, skyBottom])

  return (
    <>
      <color attach="background" args={[skyBottom]} />
      {!hasAtmosphere && <Stars radius={300} depth={60} count={4000} factor={2.5} saturation={0} fade />}

      {/* Cielo */}
      <mesh scale={[1, -1, 1]}>
        <sphereGeometry args={[450, 32, 32]} />
        <meshBasicMaterial map={skyTex} side={THREE.BackSide} fog={false} />
      </mesh>

      {/* Sol lejano */}
      <directionalLight position={[120, 80, -60]} intensity={hasAtmosphere ? 1.4 : 1.8} color={sunColor} />
      <ambientLight intensity={hasAtmosphere ? 0.5 : 0.25} color={sunColor} />

      {/* Terreno */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
        <circleGeometry args={[400, 64]} />
        <meshStandardMaterial map={groundTex} roughness={0.95} metalness={0} />
      </mesh>

      {hasAtmosphere && <fog attach="fog" args={[skyBottom, 40, 400]} />}
    </>
  )
}

/* ====== INMERSIÓN EN NUBES (Júpiter, Saturno, Urano, Neptuno) ====== */
const _texLoader = new THREE.TextureLoader()
function loadCloudTexture(url: string): THREE.Texture {
  const tex = _texLoader.load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function GasCloudImmersion({ planet }: { planet: PlanetData }) {
  const layers = useMemo(() => [
    { radius: 60,  opacity: 0.9,  repeat: 1 },
    { radius: 140, opacity: 0.55, repeat: 2 },
    { radius: 260, opacity: 0.35, repeat: 3 },
  ], [])
  const textures = useMemo(() => layers.map(() => loadCloudTexture(planet.textureUrl)), [planet.textureUrl, layers])

  return (
    <>
      <color attach="background" args={[planet.color]} />
      <fog attach="fog" args={[planet.color, 30, 260]} />
      <ambientLight intensity={0.9} color={planet.color} />
      <directionalLight position={[100, 60, 40]} intensity={0.8} color="#fff8e8" />

      {layers.map((layer, i) => {
        const tex = textures[i]
        tex.repeat.set(layer.repeat, layer.repeat)
        return (
          <mesh key={i} scale={[1, -1, 1]}>
            <sphereGeometry args={[layer.radius, 32, 32]} />
            <meshBasicMaterial map={tex} side={THREE.BackSide} transparent opacity={layer.opacity} depthWrite={false} />
          </mesh>
        )
      })}
    </>
  )
}

/* ====== VISTA PRINCIPAL — overlay de pantalla completa ====== */
export default function PlanetSurfaceView({ planet, onExit }: { planet: PlanetData; onExit: () => void }) {
  const rocoso = esRocoso(planet)

  // El motor de navegación (DeepNavEngine) aplica `transform` a la capa activa,
  // lo que la convierte en containing block de cualquier `position: fixed`
  // descendiente (comportamiento estándar de CSS) — un `fixed inset-0` quedaría
  // atrapado dentro de esa capa y se movería con su scroll interno en vez de
  // cubrir la ventana real. Un portal a document.body lo evita por completo.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black" onClick={(e) => e.stopPropagation()}>
      <Canvas camera={{ position: [0, 1.6, 0.01], fov: 75 }} dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
        {rocoso ? <RockyGround planet={planet} /> : <GasCloudImmersion planet={planet} />}
        {/* target a la altura de los ojos y hacia adelante (no al origen, que
            quedaría mirando casi derecho al piso). minDistance≈maxDistance→0:
            el "orbit" degenera en rotar la cámara en el lugar sin trasladarla
            — técnica estándar para visores 360°. */}
        <OrbitControls target={[0, 1.6, -1]} enableZoom={false} enablePan={false} minDistance={0.01} maxDistance={0.01}
          rotateSpeed={-0.5} enableDamping dampingFactor={0.1} />
      </Canvas>

      <button onClick={onExit}
        className="absolute top-4 left-4 z-10 flex items-center gap-2 glass-strong rounded-full pl-3 pr-4 py-2 text-slate-300 hover:text-white transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="font-display text-[0.6rem] tracking-[2px]">VOLVER</span>
      </button>

      <div className="absolute top-4 right-4 z-10 glass-strong rounded-full px-4 py-2">
        <span className="font-display text-[0.6rem] tracking-[2px]" style={{ color: planet.color }}>{planet.name.toUpperCase()}</span>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 font-display text-[0.55rem] tracking-[3px] text-slate-400 flex items-center gap-2.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="animate-[dragHint_2s_ease-in-out_infinite]">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
        {rocoso ? 'ARRASTRA PARA MIRAR ALREDEDOR' : 'ARRASTRA PARA MIRAR A TRAVÉS DE LAS NUBES'}
      </div>
    </div>,
    document.body
  )
}
