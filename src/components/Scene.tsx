import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { CosmicSphere } from './CosmicSphere'
import { ParticleField } from './ParticleField'
import { Starfield } from './Starfield'
import { useAudioValues } from '../hooks/useAudioAnalyzer'

export function Scene() {
  const { camera } = useThree()
  const { energy, beatIntensity, bass } = useAudioValues()
  const cameraTarget = useRef(new THREE.Vector3(0, 0, 0))
  const cameraOffset = useRef({ x: 0, y: 0 })

  useFrame((state) => {
    const time = state.clock.getElapsedTime()

    // Gentle camera drift for floating feeling
    const driftX = Math.sin(time * 0.1) * 0.5
    const driftY = Math.cos(time * 0.15) * 0.3

    // Add subtle movement based on audio
    const audioX = Math.sin(time * 0.5) * energy * 0.5
    const audioY = Math.cos(time * 0.3) * bass * 0.3

    // Smooth camera position
    cameraOffset.current.x += ((driftX + audioX) - cameraOffset.current.x) * 0.02
    cameraOffset.current.y += ((driftY + audioY) - cameraOffset.current.y) * 0.02

    // Update camera position
    camera.position.x = cameraOffset.current.x
    camera.position.y = cameraOffset.current.y + 1
    camera.position.z = 12 - energy * 2 // Move closer when music is intense

    // Always look at center
    camera.lookAt(cameraTarget.current)

    // Subtle zoom pulse on beat
    if (beatIntensity > 0.3) {
      camera.position.z -= beatIntensity * 0.5
    }
  })

  return (
    <>
      {/* Ambient light for base visibility */}
      <ambientLight intensity={0.1} />

      {/* Point lights for dynamic lighting */}
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#8B5CF6" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#EC4899" />

      {/* Background starfield */}
      <Starfield count={2500} radius={80} />

      {/* Particle galaxy */}
      <ParticleField count={4000} radius={12} />

      {/* Central cosmic sphere */}
      <CosmicSphere />

      {/* Post-processing effects */}
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.002, 0.002)}
          radialModulation={false}
          modulationOffset={0.0}
        />
        <Vignette
          offset={0.3}
          darkness={0.7}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    </>
  )
}
