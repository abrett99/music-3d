import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAudioValues } from '../hooks/useAudioAnalyzer'

interface StarfieldProps {
  count?: number
  radius?: number
}

export function Starfield({ count = 2000, radius = 100 }: StarfieldProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const { energy, treble } = useAudioValues()

  // Generate star positions on a sphere
  const { positions, sizes, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)

    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      // Random point on sphere surface
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i3 + 2] = radius * Math.cos(phi)

      // Varying star sizes
      sizes[i] = Math.random() * 2 + 0.5

      // Star colors - mostly white with hints of blue/purple
      const colorChoice = Math.random()
      if (colorChoice < 0.7) {
        color.setHSL(0, 0, 0.8 + Math.random() * 0.2) // White
      } else if (colorChoice < 0.85) {
        color.setHSL(0.6, 0.3, 0.8) // Slight blue
      } else {
        color.setHSL(0.75, 0.4, 0.7) // Slight purple
      }

      colors[i3] = color.r
      colors[i3 + 1] = color.g
      colors[i3 + 2] = color.b
    }

    return { positions, sizes, colors }
  }, [count, radius])

  // Simple shader for twinkling stars
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uTreble: { value: 0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute vec3 aColor;

        uniform float uTime;
        uniform float uEnergy;
        uniform float uTreble;

        varying vec3 vColor;
        varying float vTwinkle;

        void main() {
          vColor = aColor;

          // Twinkle effect
          float twinkle = sin(uTime * 2.0 + position.x * 10.0) * 0.5 + 0.5;
          twinkle *= sin(uTime * 3.0 + position.y * 8.0) * 0.5 + 0.5;
          vTwinkle = twinkle * (1.0 + uTreble * 2.0);

          // Size variation with audio
          float size = aSize * (1.0 + uEnergy * 0.5);

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;

        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);

          // Soft circular star
          float alpha = 1.0 - smoothstep(0.2, 0.5, dist);

          // Apply twinkle
          alpha *= 0.3 + vTwinkle * 0.7;

          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()

    if (shaderMaterial) {
      shaderMaterial.uniforms.uTime.value = time
      shaderMaterial.uniforms.uEnergy.value = energy
      shaderMaterial.uniforms.uTreble.value = treble
    }

    // Very slow rotation for subtle movement
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0001
      pointsRef.current.rotation.x += 0.00005
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
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
    </points>
  )
}
