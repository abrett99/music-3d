import { useState, useRef, useCallback } from 'react'
import { useAudioStore } from '../stores/audioStore'

type InputMode = 'file' | 'youtube'

export function UI() {
  const [isDragging, setIsDragging] = useState(false)
  const [inputMode, setInputMode] = useState<InputMode>('file')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isLoadingYoutube, setIsLoadingYoutube] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isPlaying,
    isLoading,
    isInitialized,
    currentTrack,
    error,
    initAudio,
    loadFile,
    loadAudio,
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

  const handleYoutubeSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/
    if (!youtubeRegex.test(youtubeUrl)) {
      setError('Please enter a valid YouTube URL')
      return
    }

    setIsLoadingYoutube(true)
    setError(null)

    try {
      // Call our API endpoint
      const apiUrl = import.meta.env.PROD
        ? '/api/youtube'
        : 'http://localhost:3001/api/youtube' // For local dev with separate API server

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: youtubeUrl }),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to extract audio')
      }

      if (!isInitialized) {
        await initAudio()
      }

      // Load the audio URL
      await loadAudio(data.audioUrl)

      // Extract video title from URL for display
      const videoId = youtubeUrl.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1]
      useAudioStore.setState({ currentTrack: `YouTube: ${videoId || 'video'}` })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load YouTube audio')
    } finally {
      setIsLoadingYoutube(false)
    }
  }, [youtubeUrl, isInitialized, initAudio, loadAudio, setError])

  const showLoadingState = isLoading || isLoadingYoutube

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
      {!currentTrack && !showLoadingState && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isDragging ? 'bg-white/5' : ''
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="glass rounded-3xl p-8 text-center pointer-events-auto glow-border fade-in max-w-md w-full mx-4">
            {/* Mode tabs */}
            <div className="flex mb-6 bg-white/5 rounded-full p-1">
              <button
                onClick={() => setInputMode('file')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                  inputMode === 'file'
                    ? 'bg-gradient-to-r from-cosmic-purple to-cosmic-pink text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Local File
              </button>
              <button
                onClick={() => setInputMode('youtube')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                  inputMode === 'youtube'
                    ? 'bg-gradient-to-r from-cosmic-purple to-cosmic-pink text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                YouTube
              </button>
            </div>

            {inputMode === 'file' ? (
              /* File upload mode */
              <div
                className={`cursor-pointer transition-all duration-300 ${
                  isDragging ? 'scale-105' : 'hover:scale-102'
                }`}
                onClick={handleClick}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cosmic-purple to-cosmic-pink flex items-center justify-center breathe">
                  <svg
                    className="w-8 h-8 text-white"
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

                <h2 className="text-lg font-medium mb-2">Drop your music here</h2>
                <p className="text-white/50 text-sm mb-3">
                  or click to browse
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
            ) : (
              /* YouTube mode */
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500 to-cosmic-pink flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>

                <h2 className="text-lg font-medium mb-4">Paste YouTube URL</h2>

                <form onSubmit={handleYoutubeSubmit} className="space-y-4">
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
                      text-white placeholder-white/30 focus:outline-none focus:border-cosmic-purple/50
                      transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!youtubeUrl.trim()}
                    className="w-full py-3 bg-gradient-to-r from-cosmic-purple to-cosmic-pink
                      rounded-xl font-medium text-white transition-all
                      hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Load Audio
                  </button>
                </form>

                <p className="text-xs text-white/30 mt-4">
                  Audio is extracted server-side for playback
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {showLoadingState && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="glass rounded-2xl px-8 py-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-2 border-cosmic-purple border-t-transparent rounded-full animate-spin" />
            <p className="text-white/70">
              {isLoadingYoutube ? 'Extracting audio from YouTube...' : 'Loading your music...'}
            </p>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 glass rounded-xl px-6 py-3 border border-red-500/30 fade-in pointer-events-auto">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500/20 rounded-full text-red-400 text-xs hover:bg-red-500/30"
          >
            ×
          </button>
        </div>
      )}

      {/* Play/Pause control */}
      {currentTrack && !showLoadingState && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 fade-in flex items-center gap-4">
          {/* New track button */}
          <button
            onClick={() => useAudioStore.setState({ currentTrack: '' })}
            className="pointer-events-auto glass rounded-full w-12 h-12 flex items-center justify-center
              hover:bg-white/10 transition-all duration-200 group"
            title="Load new track"
          >
            <svg
              className="w-5 h-5 text-white/50 group-hover:text-white transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>

          {/* Play/Pause */}
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
