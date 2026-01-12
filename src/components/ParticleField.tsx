import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAudioValues } from '../hooks/useAudioAnalyzer'
import { particleVertexShader, particleFragmentShader } from '../shaders/particles'

interface ParticleFieldProps {
  count?: number
  radius?: number
  colors?: string[]
}

export function ParticleField({
  count = 3000,
  radius = 15,
  colors = ['#8B5CF6', '#EC4899', '#3B82F6', '#14B8A6'],
}: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const { bass, mid, treble, energy, beatIntensity } = useAudioValues()

  // Create particle attributes
  const { positions, scales, randomness, particleColors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const randomness = new Float32Array(count)
    const particleColors = new Float32Array(count * 3)

    const colorObjects = colors.map((c) => new THREE.Color(c))

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      // Distribute particles in a toroidal/ring shape around the sphere
      const theta = Math.random() * Math.PI * 2
      const phi = (Math.random() - 0.5) * Math.PI * 0.8 // Concentrate near equator

      // Distance from center with some variation
      const r = radius * (0.4 + Math.random() * 0.6)

      positions[i3] = r * Math.cos(theta) * Math.cos(phi)
      positions[i3 + 1] = r * Math.sin(phi) * 0.5 // Flatten vertically
      positions[i3 + 2] = r * Math.sin(theta) * Math.cos(phi)

      // Random scale for each particle
      scales[i] = 0.5 + Math.random() * 1.5

      // Randomness factor for animation variation
      randomness[i] = Math.random()

      // Random color from palette
      const color = colorObjects[Math.floor(Math.random() * colorObjects.length)]
      particleColors[i3] = color.r
      particleColors[i3 + 1] = color.g
      particleColors[i3 + 2] = color.b
    }

    return { positions, scales, randomness, particleColors }
  }, [count, radius, colors])

  // Shader material for particles
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uEnergy: { value: 0 },
        uBeatIntensity: { value: 0 },
        uSize: { value: 3 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()

    if (shaderMaterial) {
      shaderMaterial.uniforms.uTime.value = time
      shaderMaterial.uniforms.uBass.value = bass
      shaderMaterial.uniforms.uMid.value = mid
      shaderMaterial.uniforms.uTreble.value = treble
      shaderMaterial.uniforms.uEnergy.value = energy
      shaderMaterial.uniforms.uBeatIntensity.value = beatIntensity
    }

    // Slow rotation of entire particle field
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0005 + energy * 0.002
    }
  })

  return (
    <points ref={pointsRef} material={shaderMaterial}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aScale"
          count={count}
          array={scales}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aRandomness"
          count={count}
          array={randomness}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={count}
          array={particleColors}
          itemSize={3}
        />
      </bufferGeometry>
    </points>
  )
}
