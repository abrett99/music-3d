import { useState, useRef, useCallback } from 'react'
import { useAudioStore } from '../stores/audioStore'

export function UI() {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isPlaying,
    isLoading,
    isInitialized,
    currentTrack,
    error,
    initAudio,
    loadFile,
    toggle,
    setError,
  } = useAudioStore()

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file')
      return
    }

    if (!isInitialized) {
      await initAudio()
    }

    await loadFile(file)
  }, [isInitialized, initAudio, loadFile, setError])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handlePlayPause = useCallback(async () => {
    if (!isInitialized) {
      await initAudio()
    }
    toggle()
  }, [isInitialized, initAudio, toggle])

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight glow-text">
              COSMIC AUDIO
            </h1>
            <p className="text-sm text-white/50 mt-1">Feel the music</p>
          </div>

          {currentTrack && (
            <div className="glass rounded-full px-4 py-2 pointer-events-auto">
              <p className="text-sm text-white/70 truncate max-w-[200px]">
                {currentTrack}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Center drop zone / intro */}
      {!currentTrack && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isDragging ? 'bg-white/5' : ''
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div
            className={`glass rounded-3xl p-12 text-center pointer-events-auto cursor-pointer
              transition-all duration-300 glow-border fade-in
              ${isDragging ? 'scale-105 border-cosmic-purple/50' : 'hover:scale-102'}
            `}
            onClick={handleClick}
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cosmic-purple to-cosmic-pink flex items-center justify-center breathe">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>

            <h2 className="text-xl font-medium mb-2">Drop your music here</h2>
            <p className="text-white/50 text-sm mb-4">
              or click to browse your files
            </p>

            <div className="flex items-center justify-center gap-2 text-xs text-white/30">
              <span>MP3</span>
              <span>•</span>
              <span>WAV</span>
              <span>•</span>
              <span>OGG</span>
              <span>•</span>
              <span>FLAC</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="glass rounded-2xl px-8 py-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-2 border-cosmic-purple border-t-transparent rounded-full animate-spin" />
            <p className="text-white/70">Loading your music...</p>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 glass rounded-xl px-6 py-3 border border-red-500/30 fade-in">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Play/Pause control */}
      {currentTrack && !isLoading && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 fade-in">
          <button
            onClick={handlePlayPause}
            className="pointer-events-auto glass rounded-full w-16 h-16 flex items-center justify-center
              hover:bg-white/10 transition-all duration-200 glow-border group"
          >
            {isPlaying ? (
              <svg
                className="w-6 h-6 text-white group-hover:text-cosmic-purple transition-colors"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-white group-hover:text-cosmic-purple transition-colors ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Keyboard hints */}
      {currentTrack && (
        <div className="absolute bottom-8 right-8 text-xs text-white/30 fade-in">
          <p>Space to play/pause</p>
        </div>
      )}

      {/* Audio visualizer bars (subtle) */}
      <AudioBars />
    </div>
  )
}

// Small audio visualizer in corner
function AudioBars() {
  const { audioData, isPlaying } = useAudioStore()

  if (!isPlaying) return null

  // Sample 8 frequency bands for display
  const bands = 8
  const bandSize = Math.floor(audioData.frequencyData.length / bands)

  const values = Array.from({ length: bands }, (_, i) => {
    let sum = 0
    for (let j = 0; j < bandSize; j++) {
      sum += audioData.frequencyData[i * bandSize + j]
    }
    return sum / bandSize / 255
  })

  return (
    <div className="absolute bottom-8 left-8 flex items-end gap-1 h-8 fade-in">
      {values.map((value, i) => (
        <div
          key={i}
          className="w-1 bg-gradient-to-t from-cosmic-purple to-cosmic-pink rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(4, value * 32)}px`,
            opacity: 0.5 + value * 0.5,
          }}
        />
      ))}
    </div>
  )
}
