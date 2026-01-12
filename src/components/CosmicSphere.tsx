import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAudioValues } from '../hooks/useAudioAnalyzer'
import {
  cosmicSphereVertexShader,
  cosmicSphereFragmentShader,
  innerGlowVertexShader,
  innerGlowFragmentShader,
} from '../shaders/cosmicSphere'

interface CosmicSphereProps {
  color1?: string
  color2?: string
  color3?: string
}

export function CosmicSphere({
  color1 = '#8B5CF6', // Purple
  color2 = '#EC4899', // Pink
  color3 = '#3B82F6', // Blue
}: CosmicSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const innerGlowRef = useRef<THREE.Mesh>(null)
  const { bass, mid, treble, energy, beatIntensity } = useAudioValues()

  // Main sphere shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: cosmicSphereVertexShader,
      fragmentShader: cosmicSphereFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uEnergy: { value: 0 },
        uBeatIntensity: { value: 0 },
        uDistortion: { value: 0.3 },
        uColor1: { value: new THREE.Color(color1) },
        uColor2: { value: new THREE.Color(color2) },
        uColor3: { value: new THREE.Color(color3) },
        uOpacity: { value: 0.9 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [color1, color2, color3])

  // Inner glow material
  const innerGlowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: innerGlowVertexShader,
      fragmentShader: innerGlowFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(color2) },
        uIntensity: { value: 1.5 },
        uEnergy: { value: 0 },
      },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [color2])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()

    // Update main sphere uniforms
    if (shaderMaterial) {
      shaderMaterial.uniforms.uTime.value = time
      shaderMaterial.uniforms.uBass.value = bass
      shaderMaterial.uniforms.uMid.value = mid
      shaderMaterial.uniforms.uTreble.value = treble
      shaderMaterial.uniforms.uEnergy.value = energy
      shaderMaterial.uniforms.uBeatIntensity.value = beatIntensity
      shaderMaterial.uniforms.uDistortion.value = 0.2 + energy * 0.4
    }

    // Update inner glow
    if (innerGlowMaterial) {
      innerGlowMaterial.uniforms.uEnergy.value = energy
    }

    // Subtle rotation
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002 + energy * 0.005
      meshRef.current.rotation.x = Math.sin(time * 0.2) * 0.1
    }

    // Scale pulse on beat
    if (meshRef.current && innerGlowRef.current) {
      const baseScale = 1 + energy * 0.15 + beatIntensity * 0.1
      meshRef.current.scale.setScalar(baseScale)
      innerGlowRef.current.scale.setScalar(baseScale * 0.85)
    }
  })

  return (
    <group>
      {/* Inner glow sphere */}
      <mesh ref={innerGlowRef} material={innerGlowMaterial}>
        <icosahedronGeometry args={[1.8, 4]} />
      </mesh>

      {/* Main cosmic sphere */}
      <mesh ref={meshRef} material={shaderMaterial}>
        <icosahedronGeometry args={[2, 64]} />
      </mesh>
    </group>
  )
}
