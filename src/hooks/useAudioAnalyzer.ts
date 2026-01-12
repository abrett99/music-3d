import { useEffect, useRef } from 'react'
import { useAudioStore } from '../stores/audioStore'

export function useAudioAnalyzer() {
  const updateAudioData = useAudioStore((state) => state.updateAudioData)
  const isInitialized = useAudioStore((state) => state.isInitialized)
  const frameRef = useRef<number>()

  useEffect(() => {
    if (!isInitialized) return

    const animate = () => {
      updateAudioData()
      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [isInitialized, updateAudioData])
}

// Hook to get smooth audio values for animations
export function useAudioValues() {
  const audioData = useAudioStore((state) => state.audioData)

  return {
    bass: audioData.smoothBass,
    mid: audioData.smoothMid,
    treble: audioData.smoothTreble,
    energy: audioData.smoothEnergy,
    isBeat: audioData.isBeat,
    beatIntensity: audioData.beatIntensity,
    rawBass: audioData.bass,
    rawMid: audioData.mid,
    rawTreble: audioData.treble,
    frequencyData: audioData.frequencyData,
  }
}
