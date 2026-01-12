import { useState, useRef, useCallback, useEffect } from 'react'
import { useAudioStore } from '../stores/audioStore'
import { useSpotifyStore, getSpotifyAuthUrl, initSpotifyAuth } from '../stores/spotifyStore'
import { useAppleMusicStore, getStoredAppleMusicToken } from '../stores/appleMusicStore'

type InputMode = 'file' | 'youtube' | 'spotify' | 'apple'

export function UI() {
  const [isDragging, setIsDragging] = useState(false)
  const [inputMode, setInputMode] = useState<InputMode>('file')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isLoadingYoutube, setIsLoadingYoutube] = useState(false)
  const [spotifyClientId, setSpotifyClientId] = useState('')
  const [spotifySearch, setSpotifySearch] = useState('')
  const [spotifyResults, setSpotifyResults] = useState<Awaited<ReturnType<typeof spotifyStore.searchTracks>>>([])
  const [appleDeveloperToken, setAppleDeveloperToken] = useState('')
  const [appleSearch, setAppleSearch] = useState('')
  const [appleResults, setAppleResults] = useState<Awaited<ReturnType<typeof appleMusicStore.searchTracks>>>([])
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

  const spotifyStore = useSpotifyStore()
  const appleMusicStore = useAppleMusicStore()

  // Initialize Spotify from stored token or OAuth callback
  useEffect(() => {
    const token = initSpotifyAuth()
    if (token) {
      spotifyStore.setAccessToken(token)
      spotifyStore.initializeSDK().then(() => {
        spotifyStore.connect()
      })
    }
  }, [])

  // Initialize Apple Music from stored token
  useEffect(() => {
    const token = getStoredAppleMusicToken()
    if (token) {
      setAppleDeveloperToken(token)
      appleMusicStore.initializeSDK(token)
    }
  }, [])

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
      // Try multiple cobalt instances for redundancy
      const cobaltInstances = [
        'https://api.cobalt.tools',
        'https://cobalt-api.kwiatekmiki.com',
        'https://cobalt.api.timelessnesses.me',
      ]

      let audioUrl: string | null = null
      let lastError: string = 'All extraction services failed'

      // First, try our serverless API if available (works on Vercel)
      if (window.location.hostname !== 'localhost') {
        try {
          const apiResponse = await fetch('/api/youtube', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: youtubeUrl }),
          })

          if (apiResponse.ok) {
            const apiData = await apiResponse.json()
            if (apiData.success && apiData.audioUrl) {
              audioUrl = apiData.audioUrl
            }
          }
        } catch {
          // Serverless API not available (e.g., on GitHub Pages), continue to direct API calls
        }
      }

      // If serverless API didn't work, try cobalt instances directly
      if (!audioUrl) {
        for (const instance of cobaltInstances) {
          try {
            const response = await fetch(instance, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                url: youtubeUrl,
                downloadMode: 'audio',
                audioFormat: 'mp3',
                audioBitrate: '128',
              }),
            })

            if (response.ok) {
              const data = await response.json()
              if (data.url || data.audio) {
                audioUrl = data.url || data.audio
                break
              }
            }
          } catch (err) {
            lastError = err instanceof Error ? err.message : 'Request failed'
            // Continue to next instance
          }
        }
      }

      if (!audioUrl) {
        throw new Error(`YouTube extraction is currently unavailable. ${lastError}. Please try using a local file, Spotify, or Apple Music instead.`)
      }

      if (!isInitialized) {
        await initAudio()
      }

      // Load the audio URL
      await loadAudio(audioUrl)

      // Extract video title from URL for display
      const videoId = youtubeUrl.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1]
      useAudioStore.setState({ currentTrack: `YouTube: ${videoId || 'video'}` })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load YouTube audio')
    } finally {
      setIsLoadingYoutube(false)
    }
  }, [youtubeUrl, isInitialized, initAudio, loadAudio, setError])

  // Spotify handlers
  const handleSpotifyAuth = useCallback(() => {
    if (!spotifyClientId.trim()) {
      setError('Please enter your Spotify Client ID')
      return
    }
    const redirectUri = window.location.origin + window.location.pathname
    const authUrl = getSpotifyAuthUrl(spotifyClientId, redirectUri)
    localStorage.setItem('spotify_client_id', spotifyClientId)
    window.location.href = authUrl
  }, [spotifyClientId, setError])

  const handleSpotifySearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!spotifySearch.trim()) return
    const results = await spotifyStore.searchTracks(spotifySearch)
    setSpotifyResults(results)
  }, [spotifySearch, spotifyStore])

  const handleSpotifyPlay = useCallback(async (uri: string, name: string) => {
    await spotifyStore.play(uri)
    useAudioStore.setState({ currentTrack: `Spotify: ${name}` })
  }, [spotifyStore])

  // Apple Music handlers
  const handleAppleMusicInit = useCallback(async () => {
    if (!appleDeveloperToken.trim()) {
      setError('Please enter your Apple Music Developer Token')
      return
    }
    await appleMusicStore.initializeSDK(appleDeveloperToken)
    await appleMusicStore.authorize()
  }, [appleDeveloperToken, appleMusicStore, setError])

  const handleAppleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!appleSearch.trim()) return
    const results = await appleMusicStore.searchTracks(appleSearch)
    setAppleResults(results)
  }, [appleSearch, appleMusicStore])

  const handleApplePlay = useCallback(async (songId: string, name: string) => {
    await appleMusicStore.play(songId)
    useAudioStore.setState({ currentTrack: `Apple Music: ${name}` })
  }, [appleMusicStore])

  const showLoadingState = isLoading || isLoadingYoutube || spotifyStore.isConnecting || appleMusicStore.isConnecting
  const combinedError = error || spotifyStore.error || appleMusicStore.error

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
            <div className="flex flex-wrap mb-6 bg-white/5 rounded-2xl p-1 gap-1">
              <button
                onClick={() => setInputMode('file')}
                className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                  inputMode === 'file'
                    ? 'bg-gradient-to-r from-cosmic-purple to-cosmic-pink text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                File
              </button>
              <button
                onClick={() => setInputMode('youtube')}
                className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                  inputMode === 'youtube'
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                YouTube
              </button>
              <button
                onClick={() => setInputMode('spotify')}
                className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                  inputMode === 'spotify'
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Spotify
              </button>
              <button
                onClick={() => setInputMode('apple')}
                className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                  inputMode === 'apple'
                    ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Apple
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
            ) : inputMode === 'youtube' ? (
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
                    className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600
                      rounded-xl font-medium text-white transition-all
                      hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Load Audio
                  </button>
                </form>

                <p className="text-xs text-white/30 mt-4">
                  Note: YouTube extraction may be temporarily unavailable
                </p>
              </div>
            ) : inputMode === 'spotify' ? (
              /* Spotify mode */
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                </div>

                {!spotifyStore.isAuthenticated ? (
                  <div>
                    <h2 className="text-lg font-medium mb-2">Connect to Spotify</h2>
                    <p className="text-xs text-white/50 mb-4">Requires Spotify Premium</p>

                    <div className="space-y-4">
                      <input
                        type="text"
                        value={spotifyClientId}
                        onChange={(e) => setSpotifyClientId(e.target.value)}
                        placeholder="Spotify Client ID"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
                          text-white placeholder-white/30 focus:outline-none focus:border-green-500/50
                          transition-colors text-sm"
                      />
                      <button
                        onClick={handleSpotifyAuth}
                        disabled={!spotifyClientId.trim()}
                        className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600
                          rounded-xl font-medium text-white transition-all
                          hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Connect with Spotify
                      </button>
                    </div>

                    <p className="text-xs text-white/30 mt-4">
                      Get your Client ID from{' '}
                      <a
                        href="https://developer.spotify.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:underline"
                      >
                        Spotify Developer Dashboard
                      </a>
                    </p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-lg font-medium mb-4">Search Spotify</h2>

                    <form onSubmit={handleSpotifySearch} className="space-y-4">
                      <input
                        type="text"
                        value={spotifySearch}
                        onChange={(e) => setSpotifySearch(e.target.value)}
                        placeholder="Search for songs..."
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
                          text-white placeholder-white/30 focus:outline-none focus:border-green-500/50
                          transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={!spotifySearch.trim()}
                        className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600
                          rounded-xl font-medium text-white transition-all
                          hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Search
                      </button>
                    </form>

                    {spotifyResults.length > 0 && (
                      <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
                        {spotifyResults.map((track) => (
                          <button
                            key={track.id}
                            onClick={() => handleSpotifyPlay(track.uri, track.name)}
                            className="w-full flex items-center gap-3 p-2 bg-white/5 rounded-lg
                              hover:bg-white/10 transition-colors text-left"
                          >
                            {track.albumArt && (
                              <img
                                src={track.albumArt}
                                alt={track.album}
                                className="w-10 h-10 rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{track.name}</p>
                              <p className="text-xs text-white/50 truncate">{track.artists}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Apple Music mode */
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 0 0 1.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.8-.228-2.403-.96-.63-.767-.727-1.66-.457-2.6.326-1.13 1.168-1.77 2.27-2.03.39-.092.79-.126 1.19-.168.364-.04.73-.073 1.096-.12.186-.024.357-.083.442-.27.05-.11.072-.235.072-.358V7.03c0-.095-.023-.18-.1-.253-.08-.074-.17-.093-.27-.072L10.6 7.632c-.06.014-.12.035-.173.067-.1.058-.144.15-.155.262-.012.12-.013.24-.013.36v9.33c0 .39-.046.775-.208 1.135-.29.643-.793 1.044-1.476 1.24-.344.1-.695.158-1.053.18-1.137.07-2.1-.3-2.697-1.202-.443-.672-.543-1.423-.363-2.215.26-1.142 1.03-1.836 2.105-2.156.406-.12.823-.177 1.245-.218.394-.038.79-.072 1.182-.123.21-.028.395-.105.48-.32.043-.11.06-.23.06-.35V4.5c0-.13.015-.26.047-.39.066-.27.22-.465.48-.572.252-.106.513-.143.78-.18L17.633 2.4c.117-.015.235-.03.353-.035.21-.01.39.048.523.232.073.102.102.22.105.35.003.11 0 .22 0 .33v7.825l.003.012z"/>
                  </svg>
                </div>

                {!appleMusicStore.isAuthenticated ? (
                  <div>
                    <h2 className="text-lg font-medium mb-2">Connect to Apple Music</h2>
                    <p className="text-xs text-white/50 mb-4">Requires Apple Music subscription</p>

                    <div className="space-y-4">
                      <textarea
                        value={appleDeveloperToken}
                        onChange={(e) => setAppleDeveloperToken(e.target.value)}
                        placeholder="Apple Music Developer Token (JWT)"
                        rows={3}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
                          text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50
                          transition-colors text-sm resize-none"
                      />
                      <button
                        onClick={handleAppleMusicInit}
                        disabled={!appleDeveloperToken.trim()}
                        className="w-full py-3 bg-gradient-to-r from-pink-500 to-red-500
                          rounded-xl font-medium text-white transition-all
                          hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Connect with Apple Music
                      </button>
                    </div>

                    <p className="text-xs text-white/30 mt-4">
                      Get your Developer Token from{' '}
                      <a
                        href="https://developer.apple.com/musickit/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-400 hover:underline"
                      >
                        Apple MusicKit
                      </a>
                    </p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-lg font-medium mb-4">Search Apple Music</h2>

                    <form onSubmit={handleAppleSearch} className="space-y-4">
                      <input
                        type="text"
                        value={appleSearch}
                        onChange={(e) => setAppleSearch(e.target.value)}
                        placeholder="Search for songs..."
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
                          text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50
                          transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={!appleSearch.trim()}
                        className="w-full py-3 bg-gradient-to-r from-pink-500 to-red-500
                          rounded-xl font-medium text-white transition-all
                          hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Search
                      </button>
                    </form>

                    {appleResults.length > 0 && (
                      <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
                        {appleResults.map((track) => (
                          <button
                            key={track.id}
                            onClick={() => handleApplePlay(track.id, track.name)}
                            className="w-full flex items-center gap-3 p-2 bg-white/5 rounded-lg
                              hover:bg-white/10 transition-colors text-left"
                          >
                            {track.albumArt && (
                              <img
                                src={track.albumArt}
                                alt={track.album}
                                className="w-10 h-10 rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{track.name}</p>
                              <p className="text-xs text-white/50 truncate">{track.artists}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
      {combinedError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 glass rounded-xl px-6 py-3 border border-red-500/30 fade-in pointer-events-auto max-w-md">
          <p className="text-red-400 text-sm">{combinedError}</p>
          <button
            onClick={() => {
              setError(null)
              spotifyStore.setError(null)
              appleMusicStore.setError(null)
            }}
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
