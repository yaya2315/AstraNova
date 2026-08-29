'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { planets, type PlanetData } from '@/lib/data'
import { Sun, Planet, OrbitPaths, AsteroidBelt, Comets, SUN_RADIUS } from './SolarSystem'

// Mismo criterio que en SolarSystem.tsx: este componente solo se monta en
// el cliente, así que chequear window acá arriba es seguro.
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768

// Sensibilidad de giro: separada por eje. El giro horizontal (izq/der) se
// tocaba sin querer y giraba de golpe — queda más "duro" que el vertical,
// con más recorrido de arrastre para llegar al máximo y un techo de
// velocidad angular más bajo, así responde pero no se dispara con un roce.
const PITCH_TURN_RATE = 1.6   // rad/s al arrastrar verticalmente hasta el borde
const YAW_TURN_RATE = 0.95    // rad/s al girar horizontalmente a fondo (drag o A/D)
const MAX_DRAG_PX_PITCH = 140 // arrastre (px) para llegar al giro vertical máximo
const MAX_DRAG_PX_YAW = 220   // arrastre (px) para llegar al giro horizontal máximo — más seco
const BASE_SPEED = 9          // unidades/seg a 1x de empuje
const MIN_THRUST = -0.6       // empuje mínimo — un poco de reversa al frenar a fondo con S
const MAX_THRUST = 3
const START_DISTANCE = 95     // más allá de Neptuno (orbit≈48), vista de conjunto al entrar
const MAX_DISTANCE = 95       // contención: no alejarse más allá del borde del sistema
const AUTOPILOT_TURN = 1.5    // rad/s de corrección al pasarse del límite exterior
const COLLISION_BUFFER = 1.5  // margen extra sobre el radio real de cada cuerpo
const COLISION_DURACION = 1.8 // segundos que dura la secuencia de choque antes de reaparecer
const CAMERA_FOV = 50         // lente más cerrado — menos "ojo de pez", da sensación de mayor escala

// Manejo por teclado — W/↑ acelera, S/↓ frena (o da reversa), A/D o ←/→
// giran, Z activa el turbo. En celular/tablet no hay teclado: el botón de
// "acelerar" de la esquina hace exactamente lo mismo que mantener W.
const THRUST_ACCEL = 1.7      // unidades de empuje por segundo con W/↑ (o el botón táctil)
const BRAKE_ACCEL = 2.6       // frenar es más brusco que acelerar
const THRUST_DECAY = 0.5      // "arrastre" pasivo: sin acelerar ni frenar, el empuje decae solo
const TURBO_BONUS = 1.8       // empuje extra máximo alcanzable con Z
const TURBO_ACCEL_MULT = 1.7  // con Z, acelera más rápido hacia ese máximo

type BodyEntry = { obj: THREE.Object3D; radius: number; label: string; color: string }

// Convierte el `data.color` hex de cada planeta (ya usado en toda la app para
// el aro/halo de cada uno) en el degradado del flash de choque — el centro
// siempre es blanco (el destello del impacto), el anillo medio toma el color
// propio del cuerpo. Si por algún motivo no llega color (no debería pasar,
// todo body registrado trae uno), cae a un naranja genérico.
function colisionGradient(hex: string | null): string {
  let r = 255, g = 150, b = 60
  if (hex) {
    const clean = hex.replace('#', '')
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
    const n = parseInt(full, 16)
    if (!Number.isNaN(n)) { r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255 }
  }
  return `radial-gradient(circle, rgba(255,255,255,.95), rgba(${r},${g},${b},.55) 55%, transparent 78%)`
}

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
/* Aleta — perfil barrido (no una simple caja) extrudado con un poco de
   espesor, para que la silueta se lea como una pieza diseñada. */
function useFinGeometry() {
  return useMemo(() => {
    const forma = new THREE.Shape()
    forma.moveTo(0, 0.02)
    forma.lineTo(0.34, -0.06)
    forma.lineTo(0.31, -0.24)
    forma.lineTo(0.07, -0.3)
    forma.lineTo(0, -0.14)
    forma.closePath()
    const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.026, bevelEnabled: false })
    geo.center()
    return geo
  }, [])
}

/* Llama de turbo — un cono chico por motor, invisible por defecto (mesh
   siempre montado con visible=false: no hay que crear/destruir geometría al
   entrar y salir de turbo, solo prender/apagar un flag). Mientras Z está
   presionada, cada cuadro lee el mismo Set de teclas que ya usa FlightRig
   (sin estado de React, sin re-render) y anima largo/opacidad con un par de
   senos — nada de partículas ni texturas, el material es un MeshBasicMaterial
   sin luces (el más barato de Three) con blending aditivo para que "brille". */
function TurboFlame({ keysRef, fase }: { keysRef: React.RefObject<Set<string>>; fase: number }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const activo = keysRef.current.has('z')
    if (mesh.visible !== activo) mesh.visible = activo
    if (!activo) return
    const t = clock.elapsedTime * 18 + fase
    const flicker = 0.75 + Math.sin(t) * 0.2 + Math.sin(t * 2.7) * 0.08
    mesh.scale.set(1, flicker, 1)
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.55 + flicker * 0.35
  })
  return (
    <mesh ref={ref} visible={false} position={[0, -0.16, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.05, 0.22, 10]} />
      <meshBasicMaterial color="#ff9a3d" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}

function Cockpit({ keysRef, colisionActivaRef }: { keysRef: React.RefObject<Set<string>>; colisionActivaRef: React.RefObject<boolean> }) {
  const groupRef = useRef<THREE.Group>(null!)
  const { camera } = useThree()
  const finGeo = useFinGeometry()
  const posicionesAletas = useMemo(() => [0, 120, 240].map(deg => (deg * Math.PI) / 180), [])

  useFrame(() => {
    groupRef.current.position.copy(camera.position)
    groupRef.current.quaternion.copy(camera.quaternion)
    // Se oculta apenas arranca la secuencia de choque: antes se quedaba
    // flotando ahí, intacta, mientras el texto decía "NAVE DESTRUIDA" — se
    // veía raro. Vuelve a aparecer sola cuando FlightRig reubica la cámara
    // en el punto de entrada al terminar la secuencia (colisionActiva pasa
    // a false de nuevo).
    groupRef.current.visible = !colisionActivaRef.current
  })

  return (
    <group ref={groupRef}>
      {/* Rotación negativa (antes positiva): con +θ la punta del cono quedaba
          más cerca de la cámara que los motores — el cohete "miraba" al
          jugador en vez de apuntar hacia adelante. Invertir el signo conserva
          la misma inclinación vertical (cos es par) pero manda la punta lejos
          de la cámara y los motores cerca, como corresponde en vista 1ª persona. */}
      <group position={[0, -0.7, -2.8]} rotation={[-(Math.PI / 2 + 0.18), 0, 0]} scale={0.3}>
        {/* Punta — cono afilado */}
        <mesh position={[0, 1.0, 0]}>
          <coneGeometry args={[0.16, 0.4, 20]} />
          <meshStandardMaterial color="#eef0f4" metalness={0.75} roughness={0.2} />
        </mesh>

        {/* Hombro — pasa de la punta al ancho del fuselaje */}
        <mesh position={[0, 0.68, 0]}>
          <cylinderGeometry args={[0.16, 0.24, 0.24, 20]} />
          <meshStandardMaterial color="#dcdfe4" metalness={0.65} roughness={0.3} />
        </mesh>

        {/* Anillo de acento — el cian del sitio, marca la unión punta/cuerpo */}
        <mesh position={[0, 0.555, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.243, 0.007, 8, 24]} />
          <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={1.4} roughness={0.4} />
        </mesh>

        {/* Sensor frontal — un "ojo" pequeño, no una ventana de cabina */}
        <mesh position={[0, 0.5, 0.19]}>
          <sphereGeometry args={[0.032, 12, 12]} />
          <meshStandardMaterial color="#062a30" emissive="#00F0FF" emissiveIntensity={0.9} roughness={0.3} />
        </mesh>

        {/* Fuselaje — segmento principal con dos líneas de panel finas */}
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.42, 20]} />
          <meshStandardMaterial color="#9aa0a8" metalness={0.55} roughness={0.4} />
        </mesh>
        {[0.44, 0.2].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2405, 0.0035, 6, 20]} />
            <meshStandardMaterial color="#565b61" metalness={0.4} roughness={0.6} />
          </mesh>
        ))}

        {/* Cuerpo trasero — se angosta hacia la falda de motores */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.24, 0.2, 0.2, 20]} />
          <meshStandardMaterial color="#83898f" metalness={0.5} roughness={0.45} />
        </mesh>

        {/* Falda — se abre justo antes de los motores, como en un cohete real */}
        <mesh position={[0, -0.13, 0]}>
          <cylinderGeometry args={[0.2, 0.27, 0.13, 20]} />
          <meshStandardMaterial color="#6a6f75" metalness={0.55} roughness={0.4} />
        </mesh>

        {/* Aletas — tres, barridas, con un filo cian fino */}
        {posicionesAletas.map((rad, i) => (
          <group key={i} position={[Math.sin(rad) * 0.235, -0.19, Math.cos(rad) * 0.235]} rotation={[0, -rad, 0]}>
            <mesh geometry={finGeo}>
              <meshStandardMaterial color="#8a2b2b" metalness={0.3} roughness={0.5} />
            </mesh>
            <mesh position={[0, -0.04, 0.014]}>
              <boxGeometry args={[0.22, 0.012, 0.004]} />
              <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={0.8} />
            </mesh>
          </group>
        ))}

        {/* Motores — tres toberas con resplandor de escape */}
        {posicionesAletas.map((rad, i) => (
          <group key={i} position={[Math.sin(rad) * 0.11, -0.27, Math.cos(rad) * 0.11]}>
            <mesh>
              <cylinderGeometry args={[0.055, 0.075, 0.16, 14]} />
              <meshStandardMaterial color="#2b2d31" metalness={0.7} roughness={0.35} />
            </mesh>
            <mesh position={[0, -0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.055, 0.012, 8, 16]} />
              <meshStandardMaterial color="#ff8a3d" emissive="#ff8a3d" emissiveIntensity={2} />
            </mesh>
            <TurboFlame keysRef={keysRef} fase={i * 2.1} />
          </group>
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
function FlightRig({ steerRef, thrustRef, bodyRefs, keysRef, touchAccelRef, regresarRef, colisionActivaRef, onBoundsChange, onNearestChange, onColision }: {
  steerRef: React.RefObject<{ x: number; y: number }>
  thrustRef: React.RefObject<number>
  bodyRefs: React.RefObject<Map<string, BodyEntry>>
  keysRef: React.RefObject<Set<string>>
  touchAccelRef: React.RefObject<boolean>
  regresarRef: React.RefObject<boolean>
  // Compartido con <Cockpit> (afuera de este componente) para poder ocultar
  // la nave apenas choca — ver el comentario en Cockpit.
  colisionActivaRef: React.RefObject<boolean>
  onBoundsChange: (out: boolean) => void
  onNearestChange: (label: string | null) => void
  onColision: (tipo: 'planeta' | 'sol' | null, color?: string | null) => void
}) {
  const { camera } = useThree()
  const yaw = useRef(0)
  const pitch = useRef(0)
  const wasOut = useRef(false)
  const lastNearestLabel = useRef<string | null>(null)
  const colisionActiva = colisionActivaRef
  const colisionTimer = useRef(0)
  const colisionPos = useRef(new THREE.Vector3())

  const posicionInicial = useCallback(() => {
    camera.position.set(0, 24, START_DISTANCE)
    camera.quaternion.identity()
    yaw.current = 0
    pitch.current = 0
  }, [camera])

  useLayoutEffect(() => { posicionInicial() }, [posicionInicial])

  // Teclado: se escucha en window (no en el canvas) para que funcione sin
  // importar dónde esté el foco. preventDefault en las teclas usadas evita
  // que las flechas hagan scroll de la página de fondo mientras se vuela.
  useEffect(() => {
    const TECLAS_USADAS = new Set(['w', 'a', 's', 'd', 'z', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])
    function alPresionar(e: KeyboardEvent) {
      const tecla = e.key.toLowerCase()
      if (!TECLAS_USADAS.has(tecla)) return
      e.preventDefault()
      keysRef.current.add(tecla)
    }
    function alSoltar(e: KeyboardEvent) {
      keysRef.current.delete(e.key.toLowerCase())
    }
    function alPerderFoco() {
      keysRef.current.clear()
    }
    window.addEventListener('keydown', alPresionar)
    window.addEventListener('keyup', alSoltar)
    window.addEventListener('blur', alPerderFoco)
    return () => {
      window.removeEventListener('keydown', alPresionar)
      window.removeEventListener('keyup', alSoltar)
      window.removeEventListener('blur', alPerderFoco)
      keysRef.current.clear()
    }
  }, [keysRef])

  useFrame((_, delta) => {
    // Botón "VOLVER AL SISTEMA" — te devuelve de un salto al punto de
    // entrada en vez de dejarte esperar a que el autopiloto te gire solo.
    if (regresarRef.current) {
      regresarRef.current = false
      posicionInicial()
      thrustRef.current = 0
      if (wasOut.current) { wasOut.current = false; onBoundsChange(false) }
      return
    }

    // Secuencia de "choque": la nave queda congelada en el punto de impacto
    // (con una sacudida chiquita que decae) mientras la pantalla hace el
    // resto del efecto — nada de física de explosión real, solo unos
    // segundos de espera antes de reaparecer en el punto de entrada.
    if (colisionActiva.current) {
      colisionTimer.current += delta
      const restante = COLISION_DURACION - colisionTimer.current
      if (restante > 0) {
        const intensidad = Math.min(0.4, restante) * 0.1
        camera.position.copy(colisionPos.current)
        camera.position.x += (Math.random() - 0.5) * intensidad
        camera.position.y += (Math.random() - 0.5) * intensidad
        camera.position.z += (Math.random() - 0.5) * intensidad
      } else {
        colisionActiva.current = false
        posicionInicial()
        thrustRef.current = 0
        onColision(null)
      }
      return
    }

    const distToCenter = camera.position.length()
    const outOfBounds = distToCenter > MAX_DISTANCE
    if (outOfBounds !== wasOut.current) { wasOut.current = outOfBounds; onBoundsChange(outOfBounds) }

    const keys = keysRef.current
    const girarIzq = keys.has('a') || keys.has('arrowleft')
    const girarDer = keys.has('d') || keys.has('arrowright')
    const keySteerX = (girarDer ? 1 : 0) - (girarIzq ? 1 : 0)

    if (outOfBounds) {
      const toCenter = camera.position.clone().negate().normalize()
      const desiredQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), toCenter)
      camera.quaternion.slerp(desiredQuat, Math.min(1, AUTOPILOT_TURN * delta))
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      yaw.current = e.y; pitch.current = e.x
    } else {
      const steer = steerRef.current
      const steerX = Math.max(-1, Math.min(1, steer.x + keySteerX))
      yaw.current   += -steerX * YAW_TURN_RATE * delta
      pitch.current += -steer.y * PITCH_TURN_RATE * delta
      pitch.current = Math.max(-1.15, Math.min(1.15, pitch.current))
      camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))
    }

    // Empuje: W/↑ (o mantener el botón táctil) acelera, S/↓ frena, Z da
    // turbo. Sin ninguno de los tres, el empuje decae solo — así en celular,
    // donde no hay tecla de freno, alcanza con soltar el botón para bajar
    // la velocidad de a poco.
    const turboActivo = keys.has('z')
    const acelerando = keys.has('w') || keys.has('arrowup') || touchAccelRef.current
    const frenando = keys.has('s') || keys.has('arrowdown')
    const techoEmpuje = turboActivo ? MAX_THRUST + TURBO_BONUS : MAX_THRUST
    let empuje = thrustRef.current
    if (acelerando) {
      empuje += THRUST_ACCEL * (turboActivo ? TURBO_ACCEL_MULT : 1) * delta
    } else if (frenando) {
      empuje -= BRAKE_ACCEL * delta
    } else if (Math.abs(empuje) > 0.001) {
      empuje -= empuje * THRUST_DECAY * delta
    } else {
      empuje = 0
    }
    thrustRef.current = Math.max(MIN_THRUST, Math.min(techoEmpuje, empuje))

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
        // Choque real: se congela acá (nada de atravesar ni rebotar) y
        // arranca la secuencia de destrucción — el Sol "derrite" la nave,
        // cualquier otro cuerpo la hace explotar.
        colisionActiva.current = true
        colisionTimer.current = 0
        colisionPos.current.copy(camera.position)
        thrustRef.current = 0
        lastNearestLabel.current = null
        onNearestChange(null)
        onColision(nearestName === '__sun__' ? 'sol' : 'planeta', entry.color)
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
    if (obj && data) bodyRefs.current.set(name, { obj, radius: data.size, label: data.name, color: data.color })
    else bodyRefs.current.delete(name)
  }, [bodyRefs])

  useEffect(() => {
    // El Sol no se mueve — se registra una sola vez con posición fija en el origen.
    // Color propio (no viene de `data`, el Sol no está en `planets`): un
    // amarillo-naranja cálido que combina con el resto de su iconografía en
    // el sitio (glow, erupción solar, etc.)
    bodyRefs.current.set('__sun__', { obj: { position: new THREE.Vector3(0, 0, 0) } as THREE.Object3D, radius: SUN_RADIUS, label: 'el Sol', color: '#FFDD88' })
    return () => { bodyRefs.current.delete('__sun__') }
  }, [bodyRefs])

  return (
    <>
      <ambientLight intensity={0.5} color="#334466" />
      <directionalLight position={[-15, 5, -20]} intensity={0.6} color="#6680cc" />
      <Stars radius={220} depth={100} count={IS_MOBILE ? 1500 : 2600} factor={3} saturation={0} fade />
      {!IS_MOBILE && <Galaxies />}
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
  const keysRef = useRef(new Set<string>())
  const touchAccelRef = useRef(false)
  const regresarRef = useRef(false)
  const colisionActivaRef = useRef(false)
  const [outOfBounds, setOutOfBounds] = useState(false)
  const [nearest, setNearest] = useState<string | null>(null)
  const [colision, setColision] = useState<'planeta' | 'sol' | null>(null)
  // Color del cuerpo contra el que se chocó (data.color de ese planeta, o el
  // tono propio del Sol) — tiñe el flash/overlay de choque para que Marte
  // "explote" en rojizo, Saturno en un tono arena, la Tierra en azul, etc.,
  // en vez de un mismo naranja genérico sin importar contra qué se chocó.
  const [colisionColor, setColisionColor] = useState<string | null>(null)
  const handleColision = useCallback((tipo: 'planeta' | 'sol' | null, color?: string | null) => {
    setColision(tipo)
    setColisionColor(color ?? null)
  }, [])

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
      x: Math.max(-1, Math.min(1, dx / MAX_DRAG_PX_YAW)),
      y: Math.max(-1, Math.min(1, dy / MAX_DRAG_PX_PITCH)),
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
      {/* Mismo criterio que el canvas principal de SolarSystem: en celular
          'low-power' + dpr más bajo evita que el chip sostenga clocks altos
          y termine con throttling térmico en sesiones de vuelo largas. */}
      <Canvas camera={{ fov: CAMERA_FOV }} dpr={IS_MOBILE ? [0.5, 0.85] : [1, 1.3]}
        gl={{ antialias: !IS_MOBILE, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, powerPreference: IS_MOBILE ? 'low-power' : 'high-performance' }}>
        <SystemScene bodyRefs={bodyRefs} />
        <FlightRig steerRef={steerRef} thrustRef={thrustRef} bodyRefs={bodyRefs}
          keysRef={keysRef} touchAccelRef={touchAccelRef} regresarRef={regresarRef}
          colisionActivaRef={colisionActivaRef}
          onBoundsChange={setOutOfBounds} onNearestChange={setNearest} onColision={handleColision} />
        <Cockpit keysRef={keysRef} colisionActivaRef={colisionActivaRef} />
      </Canvas>

      {/* Mira central */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none" style={{ width: 22, height: 22 }}>
        <div className="absolute inset-0 rounded-full border border-white/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/70" />
      </div>

      {colision && (
        <>
          {/* El centro del flash siempre arranca blanco (el destello del
              impacto en sí), pero el anillo medio toma el color propio del
              cuerpo contra el que se chocó — Marte queda rojizo, Saturno un
              tono arena/piel, la Tierra azulado, etc. — en vez de un mismo
              naranja genérico sin importar contra qué se chocó. */}
          <div
            className="absolute inset-0 z-40 pointer-events-none animate-[flashColision_1.8s_ease-out]"
            style={{ background: colisionGradient(colisionColor) }}
          />
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-[flashColision_1.8s_ease-out]">
            <div className="text-center">
              <p className="font-display text-[0.55rem] tracking-[3px] text-white/80 mb-2">
                {colision === 'sol' ? 'TEMPERATURA CRÍTICA' : 'COLISIÓN DETECTADA'}
              </p>
              <p className="font-display text-xl sm:text-2xl tracking-[3px] text-white font-bold"
                style={{ textShadow: '0 0 26px rgba(255,150,60,.85)' }}>
                {colision === 'sol' ? 'NAVE DESINTEGRADA' : 'NAVE DESTRUIDA'}
              </p>
            </div>
          </div>
        </>
      )}

      {outOfBounds && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 glass-strong rounded-full pl-4 pr-2 py-2 flex items-center gap-3">
          <span className="font-display text-[0.55rem] tracking-[2px] text-accent-cyan whitespace-nowrap pointer-events-none">
            LÍMITE DEL SISTEMA
          </span>
          <button onClick={() => { regresarRef.current = true }}
            className="font-display text-[0.55rem] tracking-[1.5px] px-3 py-1.5 rounded-full bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 active:bg-accent-cyan/40 transition-colors whitespace-nowrap">
            VOLVER AL SISTEMA
          </button>
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

      {/* En celular/tablet no hay teclado — este botón hace lo mismo que
          mantener W: acelera mientras se lo mantiene tocado, y al soltarlo
          el empuje decae solo (no hace falta un botón de freno aparte). En
          escritorio no se muestra: ahí el control es 100% con el teclado. */}
      {IS_MOBILE && (
        <button
          onPointerDown={(e) => { e.stopPropagation(); touchAccelRef.current = true }}
          onPointerUp={(e) => { e.stopPropagation(); touchAccelRef.current = false }}
          onPointerLeave={() => { touchAccelRef.current = false }}
          onPointerCancel={() => { touchAccelRef.current = false }}
          className="absolute bottom-6 right-5 z-20 w-16 h-16 rounded-full glass-strong flex items-center justify-center text-accent-cyan active:bg-accent-cyan/20 active:scale-95 transition-transform select-none"
          style={{ touchAction: 'none' }}
          aria-label="Mantené presionado para acelerar"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l7 12H5l7-12z" />
          </svg>
        </button>
      )}

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 font-display text-[0.55rem] tracking-[3px] text-slate-400 flex items-center gap-2.5 pointer-events-none whitespace-nowrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="animate-[dragHint_2s_ease-in-out_infinite] flex-shrink-0">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
        {IS_MOBILE ? 'ARRASTRÁ PARA DIRIGIR — MANTENÉ ▲ PARA ACELERAR' : 'ARRASTRÁ O A/D PARA GIRAR — W/S ACELERAR Y FRENAR — Z TURBO'}
      </div>
    </div>,
    document.body
  )
}
