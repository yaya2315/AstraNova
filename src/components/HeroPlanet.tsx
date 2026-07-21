'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Gas Giant Shaders ────────────────────────────────────────────────────────

const VERT = `
varying vec2 vUv;
varying vec3 vNormal;
void main(){
  vUv=uv;
  vNormal=normalize(normalMatrix*normal);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`

const FRAG = `
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;

float h(vec2 p){p=fract(p*vec2(234.34,435.35));p+=dot(p,p+34.2);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n(p);p*=2.1;a*=.48;}return v;}

void main(){
  vec2 uv=vUv;
  float t=uTime*0.035;

  // Bands
  float bands = fbm(vec2(uv.x*1.2, uv.y*7.0+t)) * 0.5
              + fbm(vec2(uv.x*2.8+t*0.4, uv.y*4.5)) * 0.3
              + fbm(vec2(uv.x*6.0-t*0.2, uv.y*2.0+t*0.3)) * 0.2;

  // Great Red Spot
  vec2 spot = vec2(0.30, 0.46);
  float spotD = length((uv - spot) * vec2(2.2, 1.0));
  float storm = exp(-spotD * spotD * 35.0);
  float swirl = fbm(uv * 12.0 + t * 0.5) * storm;

  // Palette
  vec3 c0 = vec3(0.06,0.03,0.02);
  vec3 c1 = vec3(0.38,0.18,0.06);
  vec3 c2 = vec3(0.72,0.40,0.14);
  vec3 c3 = vec3(0.88,0.66,0.34);
  vec3 c4 = vec3(0.92,0.28,0.08);
  vec3 c5 = vec3(0.96,0.82,0.58);

  vec3 col = mix(c0,c1,bands);
  col = mix(col,c2,bands*bands*1.4);
  col = mix(col,c3,fbm(uv*9.+t*.3)*0.45*bands);
  col = mix(col,c4,storm*0.9);
  col = mix(col,c5,swirl*0.5);

  // Limb darkening
  float rim = max(0.0, dot(vNormal, vec3(0,0,1)));
  rim = pow(rim, 0.6);
  col *= rim * 0.75 + 0.25;

  // Edge glow contribution
  float edge = 1.0 - rim;
  col += vec3(0.35,0.12,0.04) * edge * edge * 0.4;

  gl_FragColor = vec4(col, 1.0);
}
`

const RINGS_VERT = `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`

const RINGS_FRAG = `
varying vec2 vUv;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  float band1 = smoothstep(0.55, 0.58, r) * smoothstep(0.72, 0.69, r);
  float band2 = smoothstep(0.75, 0.78, r) * smoothstep(0.94, 0.90, r);
  float alpha = (band1 * 0.55 + band2 * 0.3);
  vec3 col = mix(vec3(0.65,0.45,0.25), vec3(0.85,0.70,0.50), band1);
  gl_FragColor = vec4(col, alpha);
}
`

// ─── Planet Component ─────────────────────────────────────────────────────────

function GasPlanet({ withRings = false }: { withRings?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const { geo, mat, rimGeo, rimMat, outerMat, ringsGeo, ringsMat } = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 80, 80)
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 } },
    })
    const rg = new THREE.SphereGeometry(1, 48, 48)
    const rm = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#FF9050'),
      transparent: true, opacity: 0.14, side: THREE.BackSide,
    })
    const om = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#FFAA44'),
      transparent: true, opacity: 0.06, side: THREE.BackSide,
    })
    // Rings (flat disk)
    const rig = new THREE.PlaneGeometry(3.2, 3.2)
    const rim = new THREE.ShaderMaterial({
      vertexShader: RINGS_VERT, fragmentShader: RINGS_FRAG,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    })
    return { geo: g, mat: m, rimGeo: rg, rimMat: rm, outerMat: om, ringsGeo: rig, ringsMat: rim }
  }, [])

  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.getElapsedTime()
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0006
    }
  })

  return (
    <group>
      <mesh ref={meshRef}>
        <primitive object={geo} attach="geometry" />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Atmosphere layers */}
      <mesh scale={1.07}>
        <primitive object={rimGeo} attach="geometry" />
        <primitive object={rimMat} attach="material" />
      </mesh>
      <mesh scale={1.18}>
        <primitive object={rimGeo} attach="geometry" />
        <primitive object={outerMat} attach="material" />
      </mesh>
      {/* Optional rings */}
      {withRings && (
        <mesh rotation={[Math.PI * 0.18, 0.2, 0]}>
          <primitive object={ringsGeo} attach="geometry" />
          <primitive object={ringsMat} attach="material" />
        </mesh>
      )}
    </group>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function HeroPlanet({ withRings = false }: { withRings?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      style={{ background: 'transparent' }}
    >
      {/* Key light — simulated sun from top-left */}
      <directionalLight position={[-4, 3, 2]} intensity={2.2} color="#FFD0A0" />
      {/* Fill light — faint from right */}
      <directionalLight position={[3, -1, 1]} intensity={0.15} color="#5544CC" />
      {/* Ambient */}
      <ambientLight intensity={0.08} color="#110A22" />

      <GasPlanet withRings={withRings} />
    </Canvas>
  )
}
