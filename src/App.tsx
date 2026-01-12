import { useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './components/Scene'
import { UI } from './components/UI'
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer'
import { useAudioStore } from './stores/audioStore'

// Component to handle audio analysis loop
function AudioAnalyzerProvider({ children }: { children: React.ReactNode }) {
  useAudioAnalyzer()
  return <>{children}</>
}

// Keyboard controls
function KeyboardControls() {
  const { toggle, currentTrack } = useAudioStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space to play/pause
      if (e.code === 'Space' && currentTrack) {
        e.preventDefault()
        toggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle, currentTrack])

  return null
}

// Loading fallback
function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color="#8B5CF6" wireframe />
    </mesh>
  )
}

export default function App() {
  return (
    <div className="w-full h-full bg-black">
      <AudioAnalyzerProvider>
        <KeyboardControls />

        {/* 3D Canvas */}
        <Canvas
          camera={{
            position: [0, 1, 12],
            fov: 60,
            near: 0.1,
            far: 200,
          }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          dpr={[1, 2]}
        >
          <color attach="background" args={['#000008']} />
          <fog attach="fog" args={['#000008', 30, 100]} />

          <Suspense fallback={<LoadingFallback />}>
            <Scene />
          </Suspense>
        </Canvas>

        {/* UI Overlay */}
        <UI />
      </AudioAnalyzerProvider>
    </div>
  )
}
