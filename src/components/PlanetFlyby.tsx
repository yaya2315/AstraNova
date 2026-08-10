'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { PlanetData } from '@/lib/data'
import { loadTexture, SaturnRings } from './SolarSystem'

const PLANET_RADIUS = 8
const FLY_SPEED = 14        // unidades/segundo
const MAX_TURN_RATE = 1.6   // rad/s al arrastrar hasta el borde
const START_DISTANCE = 70
const MAX_DRAG_PX = 140     // arrastre (px) para llegar al giro máximo

function Planet3D({ planet }: { planet: PlanetData }) {
  const ref = useRef<THREE.Mesh>(null!)
  const texture = useMemo(() => loadTexture(planet.textureUrl), [planet.textureUrl])
  useFrame((_, delta) => { ref.current.rotation.y += 0.03 * delta })
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[PLANET_RADIUS, 64, 64]} />
        <meshStandardMaterial map={texture} roughness={0.75} metalness={0.05} />
      </mesh>
      {planet.rings && <SaturnRings size={PLANET_RADIUS} />}
    </group>
  )
}

/* ====== COHETE — primera persona: solo se pilotea, no se ve la nave ====== */
function FlightRig({ steerRef }: { steerRef: React.RefObject<{ x: number; y: number }> }) {
  const { camera } = useThree()
  const yaw = useRef(0)
  const pitch = useRef(0)

  useEffect(() => {
    camera.position.set(0, 4, START_DISTANCE)
    yaw.current = 0
    pitch.current = 0
  }, [camera])

  useFrame((_, delta) => {
    const steer = steerRef.current
    yaw.current   += -steer.x * MAX_TURN_RATE * delta
    pitch.current += -steer.y * MAX_TURN_RATE * delta
    pitch.current = Math.max(-1.15, Math.min(1.15, pitch.current))

    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    camera.position.addScaledVector(forward, FLY_SPEED * delta)

    // No atravesar el planeta: si el cohete se acerca demasiado al centro, se lo empuja hacia afuera.
    const distToCenter = camera.position.length()
    if (distToCenter < PLANET_RADIUS + 3) camera.position.setLength(PLANET_RADIUS + 3)
  })

  return null
}

/* ====== VISTA PRINCIPAL — overlay de pantalla completa ====== */
export default function PlanetFlybyView({ planet, onExit }: { planet: PlanetData; onExit: () => void }) {
  const steerRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef({ active: false, startX: 0, startY: 0 })

  // Ver el comentario en el commit anterior: la capa activa de DeepNavEngine
  // aplica `transform`, lo que convierte a un `position: fixed` descendiente
  // en algo "fijo respecto a esa capa" en vez de a la ventana real. Un portal
  // a document.body lo evita.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const updateSteer = (x: number, y: number) => {
    const dx = x - dragRef.current.startX
    const dy = y - dragRef.current.startY
    steerRef.current = {
      x: Math.max(-1, Math.min(1, dx / MAX_DRAG_PX)),
      y: Math.max(-1, Math.min(1, dy / MAX_DRAG_PX)),
    }
  }
  const onDown = (e: React.PointerEvent) => { dragRef.current = { active: true, startX: e.clientX, startY: e.clientY } }
  const onMove = (e: React.PointerEvent) => { if (dragRef.current.active) updateSteer(e.clientX, e.clientY) }
  const onUp = () => { dragRef.current.active = false; steerRef.current = { x: 0, y: 0 } }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black cursor-grab active:cursor-grabbing"
      style={{ touchAction: 'none' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}
    >
      <Canvas camera={{ fov: 68 }} dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
        <ambientLight intensity={0.35} color={planet.color} />
        <directionalLight position={[40, 25, 30]} intensity={1.4} color="#fff4dc" />
        <Stars radius={300} depth={80} count={5000} factor={3} saturation={0} fade />
        <Planet3D planet={planet} />
        <FlightRig steerRef={steerRef} />
      </Canvas>

      {/* Mira central del cohete */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none" style={{ width: 22, height: 22 }}>
        <div className="absolute inset-0 rounded-full border border-white/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/70" />
      </div>

      <button onClick={onExit}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 glass-strong rounded-full pl-3 pr-4 py-2 text-slate-300 hover:text-white transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="font-display text-[0.6rem] tracking-[2px]">VOLVER</span>
      </button>

      <div className="absolute top-4 right-4 z-20 glass-strong rounded-full px-4 py-2">
        <span className="font-display text-[0.6rem] tracking-[2px]" style={{ color: planet.color }}>{planet.name.toUpperCase()}</span>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 font-display text-[0.55rem] tracking-[3px] text-slate-400 flex items-center gap-2.5 pointer-events-none">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="animate-[dragHint_2s_ease-in-out_infinite]">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
        ARRASTRA PARA DIRIGIR EL COHETE
      </div>
    </div>,
    document.body
  )
}
