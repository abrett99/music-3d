import { create } from 'zustand'

export interface AudioData {
  // Raw frequency data (0-255 for each bin)
  frequencyData: Uint8Array
  // Time domain data for waveform
  timeDomainData: Uint8Array
  // Processed values (0-1 range)
  bass: number
  mid: number
  treble: number
  // Overall energy/volume
  energy: number
  // Beat detection
  isBeat: boolean
  beatIntensity: number
  // Smoothed values for fluid animations
  smoothBass: number
  smoothMid: number
  smoothTreble: number
  smoothEnergy: number
}

interface AudioState {
  // Audio context and analyzer
  audioContext: AudioContext | null
  analyser: AnalyserNode | null
  audioSource: MediaElementAudioSourceNode | null
  audioElement: HTMLAudioElement | null

  // State
  isPlaying: boolean
  isLoading: boolean
  isInitialized: boolean
  currentTrack: string
  error: string | null

  // Audio data
  audioData: AudioData

  // Actions
  initAudio: () => Promise<void>
  loadAudio: (url: string) => Promise<void>
  loadFile: (file: File) => Promise<void>
  play: () => void
  pause: () => void
  toggle: () => void
  updateAudioData: () => void
  setError: (error: string | null) => void
}

const defaultAudioData: AudioData = {
  frequencyData: new Uint8Array(256),
  timeDomainData: new Uint8Array(256),
  bass: 0,
  mid: 0,
  treble: 0,
  energy: 0,
  isBeat: false,
  beatIntensity: 0,
  smoothBass: 0,
  smoothMid: 0,
  smoothTreble: 0,
  smoothEnergy: 0,
}

// Beat detection state
let lastBeatTime = 0
let beatThreshold = 0.6
let beatDecay = 0.98
let beatMin = 0.3
let lastEnergy = 0

// Smoothing factor (lower = smoother)
const SMOOTH_FACTOR = 0.15

export const useAudioStore = create<AudioState>((set, get) => ({
  audioContext: null,
  analyser: null,
  audioSource: null,
  audioElement: null,
  isPlaying: false,
  isLoading: false,
  isInitialized: false,
  currentTrack: '',
  error: null,
  audioData: defaultAudioData,

  initAudio: async () => {
    const state = get()
    if (state.isInitialized) return

    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const analyser = audioContext.createAnalyser()

      // Configure analyzer for detailed frequency data
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      analyser.minDecibels = -90
      analyser.maxDecibels = -10

      // Create audio element
      const audioElement = new Audio()
      audioElement.crossOrigin = 'anonymous'
      audioElement.loop = true

      // Connect audio element to analyzer
      const source = audioContext.createMediaElementSource(audioElement)
      source.connect(analyser)
      analyser.connect(audioContext.destination)

      set({
        audioContext,
        analyser,
        audioSource: source,
        audioElement,
        isInitialized: true,
        error: null,
      })
    } catch (error) {
      set({ error: 'Failed to initialize audio context' })
      console.error('Audio init error:', error)
    }
  },

  loadAudio: async (url: string) => {
    const state = get()
    if (!state.audioElement) {
      await get().initAudio()
    }

    const audioElement = get().audioElement
    if (!audioElement) return

    set({ isLoading: true, error: null })

    try {
      audioElement.src = url
      audioElement.load()

      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          audioElement.removeEventListener('canplaythrough', onCanPlay)
          audioElement.removeEventListener('error', onError)
          resolve()
        }
        const onError = () => {
          audioElement.removeEventListener('canplaythrough', onCanPlay)
          audioElement.removeEventListener('error', onError)
          reject(new Error('Failed to load audio'))
        }
        audioElement.addEventListener('canplaythrough', onCanPlay)
        audioElement.addEventListener('error', onError)
      })

      set({ isLoading: false, currentTrack: url })

      // Resume audio context if suspended
      const audioContext = get().audioContext
      if (audioContext?.state === 'suspended') {
        await audioContext.resume()
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load audio file' })
      console.error('Load audio error:', error)
    }
  },

  loadFile: async (file: File) => {
    const url = URL.createObjectURL(file)
    await get().loadAudio(url)
    set({ currentTrack: file.name })
  },

  play: () => {
    const { audioElement, audioContext } = get()
    if (audioElement) {
      if (audioContext?.state === 'suspended') {
        audioContext.resume()
      }
      audioElement.play()
      set({ isPlaying: true })
    }
  },

  pause: () => {
    const { audioElement } = get()
    if (audioElement) {
      audioElement.pause()
      set({ isPlaying: false })
    }
  },

  toggle: () => {
    const { isPlaying } = get()
    if (isPlaying) {
      get().pause()
    } else {
      get().play()
    }
  },

  updateAudioData: () => {
    const { analyser, audioData, isPlaying } = get()
    if (!analyser) return

    // Get frequency data
    const frequencyData = new Uint8Array(analyser.frequencyBinCount)
    const timeDomainData = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(frequencyData)
    analyser.getByteTimeDomainData(timeDomainData)

    // Calculate frequency bands
    const binCount = frequencyData.length
    const bassEnd = Math.floor(binCount * 0.1)    // 0-10% = bass
    const midEnd = Math.floor(binCount * 0.5)     // 10-50% = mid
    // 50-100% = treble

    let bassSum = 0
    let midSum = 0
    let trebleSum = 0
    let totalSum = 0

    for (let i = 0; i < binCount; i++) {
      const value = frequencyData[i]
      totalSum += value

      if (i < bassEnd) {
        bassSum += value
      } else if (i < midEnd) {
        midSum += value
      } else {
        trebleSum += value
      }
    }

    // Normalize to 0-1 range
    const bass = bassSum / (bassEnd * 255)
    const mid = midSum / ((midEnd - bassEnd) * 255)
    const treble = trebleSum / ((binCount - midEnd) * 255)
    const energy = totalSum / (binCount * 255)

    // Beat detection using energy spike detection
    const now = performance.now()
    const energyDelta = energy - lastEnergy
    lastEnergy = energy

    // Detect beat when energy spikes above threshold
    let isBeat = false
    let beatIntensity = audioData.beatIntensity * beatDecay

    if (energyDelta > beatThreshold && now - lastBeatTime > 100) {
      isBeat = true
      lastBeatTime = now
      beatIntensity = Math.min(1, energyDelta * 2)
      // Adaptive threshold
      beatThreshold = Math.max(beatMin, beatThreshold * 0.95)
    } else {
      // Slowly raise threshold when no beats detected
      beatThreshold = Math.min(0.8, beatThreshold * 1.01)
    }

    // Smooth values for fluid animations
    const smoothBass = audioData.smoothBass + (bass - audioData.smoothBass) * SMOOTH_FACTOR
    const smoothMid = audioData.smoothMid + (mid - audioData.smoothMid) * SMOOTH_FACTOR
    const smoothTreble = audioData.smoothTreble + (treble - audioData.smoothTreble) * SMOOTH_FACTOR
    const smoothEnergy = audioData.smoothEnergy + (energy - audioData.smoothEnergy) * SMOOTH_FACTOR

    // Only update if playing, otherwise decay values
    if (isPlaying) {
      set({
        audioData: {
          frequencyData,
          timeDomainData,
          bass,
          mid,
          treble,
          energy,
          isBeat,
          beatIntensity: beatIntensity + (isBeat ? 0.5 : 0),
          smoothBass,
          smoothMid,
          smoothTreble,
          smoothEnergy,
        }
      })
    } else {
      // Decay values when not playing
      set({
        audioData: {
          ...audioData,
          bass: audioData.bass * 0.95,
          mid: audioData.mid * 0.95,
          treble: audioData.treble * 0.95,
          energy: audioData.energy * 0.95,
          isBeat: false,
          beatIntensity: audioData.beatIntensity * 0.9,
          smoothBass: audioData.smoothBass * 0.95,
          smoothMid: audioData.smoothMid * 0.95,
          smoothTreble: audioData.smoothTreble * 0.95,
          smoothEnergy: audioData.smoothEnergy * 0.95,
        }
      })
    }
  },

  setError: (error: string | null) => set({ error }),
}))
