'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { planets, type PlanetData } from '@/lib/data'
import { Sun, Planet, OrbitPaths, AsteroidBelt, Comets, SUN_RADIUS } from './SolarSystem'

const MAX_TURN_RATE = 1.6     // rad/s al arrastrar hasta el borde
const MAX_DRAG_PX = 140       // arrastre (px) para llegar al giro máximo
const BASE_SPEED = 9          // unidades/seg a 1x de empuje
const MIN_THRUST = 0
const MAX_THRUST = 3
const THRUST_STEP = 0.25
const START_DISTANCE = 95     // más allá de Neptuno (orbit≈48), vista de conjunto al entrar
const MAX_DISTANCE = 95       // contención: no alejarse más allá del borde del sistema
const AUTOPILOT_TURN = 1.5    // rad/s de corrección al pasarse del límite exterior
const COLLISION_BUFFER = 1.5  // margen extra sobre el radio real de cada cuerpo
const CAMERA_FOV = 50         // lente más cerrado — menos "ojo de pez", da sensación de mayor escala

type BodyEntry = { obj: THREE.Object3D; radius: number; label: string }

/* ====== GALAXIAS — fondo decorativo lejano, sin física ni colisión ======
   Manchas de luz tipo "sprite" (siempre de cara a la cámara) generadas por
   canvas, dispersas muy por fuera del sistema. Tonos casi blancos con apenas
   un matiz de color (como fotos reales de galaxias lejanas) — nada de colores
   saturados tipo arcoíris, que se leían como luces de navidad. */
function generateGalaxyTexture(hue: number, squash: number): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2, cy = size / 2

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, squash)
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2)
  core.addColorStop(0, `hsla(${hue}, 22%, 96%, 0.85)`)
  core.addColorStop(0.2, `hsla(${hue}, 30%, 88%, 0.5)`)
  core.addColorStop(0.45, `hsla(${hue}, 35%, 70%, 0.2)`)
  core.addColorStop(0.75, `hsla(${hue}, 40%, 55%, 0.06)`)
  core.addColorStop(1, 'hsla(0,0%,0%,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // banda de polvo tenue — oscurece apenas el plano medio del disco, sin brillo
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, squash * 0.4)
  const dust = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2)
  dust.addColorStop(0, 'rgba(0,0,0,0.16)')
  dust.addColorStop(0.6, 'rgba(0,0,0,0.05)')
  dust.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = dust
  ctx.beginPath()
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const GALAXY_HUES = [212, 38, 258, 192, 250]

function Galaxies() {
  const galaxies = useMemo(() => {
    let seed = 1337
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    return Array.from({ length: 5 }, (_, i) => {
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(2 * rand() - 1)
      const dist = 260 + rand() * 300
      const squash = 0.3 + rand() * 0.35
      return {
        position: [
          dist * Math.sin(phi) * Math.cos(theta),
          dist * Math.cos(phi) * 0.5,
          dist * Math.sin(phi) * Math.sin(theta),
        ] as [number, number, number],
        scale: 40 + rand() * 35,
        rotation: rand() * Math.PI * 2,
        texture: generateGalaxyTexture(GALAXY_HUES[i % GALAXY_HUES.length], squash),
      }
    })
  }, [])

  return (
    <>
      {galaxies.map((g, i) => (
        <sprite key={i} position={g.position} scale={[g.scale, g.scale * 0.62, 1]}>
          <spriteMaterial
            map={g.texture}
            transparent
            opacity={0.8}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            rotation={g.rotation}
          />
        </sprite>
      ))}
    </>
  )
}

/* ====== CABINA (primera persona) — morro del cohete, apenas asoma en el borde
   inferior del cuadro. Chico y lejano a propósito: da referencia de escala sin
   tapar la vista, y hace que la nave se sienta pequeña frente a cualquier planeta. */
function Cockpit() {
  const groupRef = useRef<THREE.Group>(null!)
  const { camera } = useThree()

  useFrame(() => {
    groupRef.current.position.copy(camera.position)
    groupRef.current.quaternion.copy(camera.quaternion)
  })

  return (
    <group ref={groupRef}>
      <group position={[0, -0.7, -2.8]} rotation={[Math.PI / 2 + 0.18, 0, 0]} scale={0.3}>
        <mesh>
          <coneGeometry args={[0.3, 1.3, 16]} />
          <meshStandardMaterial color="#d4d6da" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.3, 0.32, 0.3, 16]} />
          <meshStandardMaterial color="#8a8f96" metalness={0.5} roughness={0.4} />
        </mesh>
        {[0.85, -0.85].map((rot, i) => (
          <mesh key={i} position={[Math.sin(rot) * 0.32, -0.5, Math.cos(rot) * 0.32]} rotation={[0, -rot, 0]}>
            <boxGeometry args={[0.04, 0.4, 0.32]} />
            <meshStandardMaterial color="#a03030" metalness={0.3} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ====== COHETE — primera persona, con dirección (arrastre) y empuje (botones) ======
   Fix: el reset de posición inicial usa useLayoutEffect (no useEffect) — si no,
   el primer cuadro se dibuja con la cámara en su posición por defecto (0,0,5),
   casi dentro del Sol, y se ve un parpadeo antes de saltar a la posición real.
   Sistema de colisiones real contra CUALQUIER cuerpo del sistema (Sol + 8 planetas,
   todos orbitando en vivo): cada cuadro se busca el cuerpo más cercano en un Map de
   refs compartido y, si la distancia es menor a su radio + margen, se empuja la nave
   hacia afuera a lo largo de la misma línea — no atraviesa nada, sin importar cuál
   planeta sea ni dónde esté en su órbita en ese instante.
   Contención exterior: más allá de MAX_DISTANCE un "autopiloto" gira suavemente de
   vuelta hacia el centro del sistema en vez de dejar volar a la nave para siempre. */
function FlightRig({ steerRef, thrustRef, bodyRefs, onBoundsChange, onNearestChange }: {
  steerRef: React.RefObject<{ x: number; y: number }>
  thrustRef: React.RefObject<number>
  bodyRefs: React.RefObject<Map<string, BodyEntry>>
  onBoundsChange: (out: boolean) => void
  onNearestChange: (label: string | null) => void
}) {
  const { camera } = useThree()
  const yaw = useRef(0)
  const pitch = useRef(0)
  const wasOut = useRef(false)
  const lastNearestLabel = useRef<string | null>(null)

  useLayoutEffect(() => {
    camera.position.set(0, 24, START_DISTANCE)
    camera.quaternion.identity()
    yaw.current = 0
    pitch.current = 0
  }, [camera])

  useFrame((_, delta) => {
    const distToCenter = camera.position.length()
    const outOfBounds = distToCenter > MAX_DISTANCE
    if (outOfBounds !== wasOut.current) { wasOut.current = outOfBounds; onBoundsChange(outOfBounds) }

    if (outOfBounds) {
      const toCenter = camera.position.clone().negate().normalize()
      const desiredQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), toCenter)
      camera.quaternion.slerp(desiredQuat, Math.min(1, AUTOPILOT_TURN * delta))
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      yaw.current = e.y; pitch.current = e.x
    } else {
      const steer = steerRef.current
      yaw.current   += -steer.x * MAX_TURN_RATE * delta
      pitch.current += -steer.y * MAX_TURN_RATE * delta
      pitch.current = Math.max(-1.15, Math.min(1.15, pitch.current))
      camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    camera.position.addScaledVector(forward, BASE_SPEED * thrustRef.current * delta)

    // Colisión contra el cuerpo más cercano en este instante (todos en movimiento).
    let nearestName: string | null = null
    let nearestDist = Infinity
    const bodies = bodyRefs.current
    bodies?.forEach((entry, name) => {
      const d = camera.position.distanceTo(entry.obj.position)
      if (d < nearestDist) { nearestDist = d; nearestName = name }
    })

    if (nearestName) {
      const entry = bodies!.get(nearestName)!
      const proximityRange = entry.radius + 18
      const label = nearestDist < proximityRange ? entry.label : null
      if (label !== lastNearestLabel.current) { lastNearestLabel.current = label; onNearestChange(label) }

      const minD = entry.radius + COLLISION_BUFFER
      if (nearestDist < minD) {
        const dir = camera.position.clone().sub(entry.obj.position)
        dir.setLength(minD)
        camera.position.copy(entry.obj.position).add(dir)
      }
    }
  })

  return null
}

/* ====== ESCENA — Sol + 8 planetas orbitando en vivo (mismos componentes que la
   vista principal, reutilizados tal cual) + cinturón de asteroides + estrellas. */
const NOOP = () => {}

function SystemScene({ bodyRefs }: { bodyRefs: React.RefObject<Map<string, BodyEntry>> }) {
  const registerRef = useCallback((name: string, obj: THREE.Object3D | null) => {
    const data = planets.find(p => p.name === name)
    if (obj && data) bodyRefs.current.set(name, { obj, radius: data.size, label: data.name })
    else bodyRefs.current.delete(name)
  }, [bodyRefs])

  useEffect(() => {
    // El Sol no se mueve — se registra una sola vez con posición fija en el origen.
    bodyRefs.current.set('__sun__', { obj: { position: new THREE.Vector3(0, 0, 0) } as THREE.Object3D, radius: SUN_RADIUS, label: 'el Sol' })
    return () => { bodyRefs.current.delete('__sun__') }
  }, [bodyRefs])

  return (
    <>
      <ambientLight intensity={0.5} color="#334466" />
      <directionalLight position={[-15, 5, -20]} intensity={0.6} color="#6680cc" />
      <Stars radius={220} depth={100} count={4000} factor={3} saturation={0} fade />
      <Galaxies />
      <Sun />
      {planets.map((p: PlanetData) => (
        <Planet key={p.name} data={p} speedMul={1} onHover={NOOP} onLeave={NOOP} onClick={NOOP} registerRef={registerRef} />
      ))}
      <OrbitPaths />
      <AsteroidBelt />
      <Comets />
    </>
  )
}

/* ====== VISTA PRINCIPAL — overlay de pantalla completa ====== */
export default function SystemFlybyView({ onExit }: { onExit: () => void }) {
  const steerRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef({ active: false, startX: 0, startY: 0 })
  const thrustRef = useRef(0)
  const bodyRefs = useRef(new Map<string, BodyEntry>())
  const [thrustDisplay, setThrustDisplay] = useState(0)
  const [outOfBounds, setOutOfBounds] = useState(false)
  const [nearest, setNearest] = useState<string | null>(null)

  // La capa activa de DeepNavEngine aplica `transform`, lo que convierte a un
  // `position: fixed` descendiente en algo "fijo respecto a esa capa" en vez de
  // a la ventana real. Un portal a document.body lo evita.
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

  const adjustThrust = (delta: number) => {
    const next = Math.max(MIN_THRUST, Math.min(MAX_THRUST, Math.round((thrustRef.current + delta) * 100) / 100))
    thrustRef.current = next
    setThrustDisplay(next)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black cursor-grab active:cursor-grabbing"
      style={{ touchAction: 'none' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}
    >
      <Canvas camera={{ fov: CAMERA_FOV }} dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, powerPreference: 'high-performance' }}>
        <SystemScene bodyRefs={bodyRefs} />
        <FlightRig steerRef={steerRef} thrustRef={thrustRef} bodyRefs={bodyRefs}
          onBoundsChange={setOutOfBounds} onNearestChange={setNearest} />
        <Cockpit />
      </Canvas>

      {/* Mira central */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none" style={{ width: 22, height: 22 }}>
        <div className="absolute inset-0 rounded-full border border-white/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/70" />
      </div>

      {outOfBounds && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 glass-strong rounded-full px-4 py-2 pointer-events-none">
          <span className="font-display text-[0.55rem] tracking-[2px] text-accent-cyan">
            LÍMITE DEL SISTEMA — REGRESANDO AL CENTRO
          </span>
        </div>
      )}

      {nearest && !outOfBounds && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 glass-strong rounded-full px-4 py-2 pointer-events-none">
          <span className="font-display text-[0.55rem] tracking-[2px] text-accent-cyan">SOBREVOLANDO {nearest.toUpperCase()}</span>
        </div>
      )}

      <button onClick={onExit}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 glass-strong rounded-full pl-3 pr-4 py-2 text-slate-300 hover:text-white transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="font-display text-[0.6rem] tracking-[2px]">VOLVER</span>
      </button>

      {/* Control de empuje — botones, no comparte gesto con el arrastre de dirección */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 glass-strong rounded-full px-2 py-1.5">
        <button onClick={() => adjustThrust(-THRUST_STEP)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-display text-sm">−</button>
        <span className="font-display text-[0.6rem] tracking-[1px] text-accent-cyan w-10 text-center">{thrustDisplay.toFixed(2)}x</span>
        <button onClick={() => adjustThrust(THRUST_STEP)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-display text-sm">+</button>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 font-display text-[0.55rem] tracking-[3px] text-slate-400 flex items-center gap-2.5 pointer-events-none whitespace-nowrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="animate-[dragHint_2s_ease-in-out_infinite] flex-shrink-0">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
        ARRASTRA PARA DIRIGIR — +/− PARA ACELERAR
      </div>
    </div>,
    document.body
  )
}
