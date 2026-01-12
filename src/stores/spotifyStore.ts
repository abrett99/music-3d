import { create } from 'zustand'

// Spotify Web Playback SDK types
declare global {
  interface Window {
    Spotify: {
      Player: new (options: SpotifyPlayerOptions) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

interface SpotifyPlayerOptions {
  name: string
  getOAuthToken: (cb: (token: string) => void) => void
  volume?: number
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, callback: (state: unknown) => void) => boolean
  removeListener: (event: string, callback?: (state: unknown) => void) => boolean
  getCurrentState: () => Promise<SpotifyPlaybackState | null>
  setName: (name: string) => Promise<void>
  getVolume: () => Promise<number>
  setVolume: (volume: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlay: () => Promise<void>
  seek: (position_ms: number) => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
  activateElement: () => Promise<void>
}

interface SpotifyPlaybackState {
  context: {
    uri: string
    metadata: Record<string, unknown>
  }
  disallows: {
    pausing: boolean
    peeking_next: boolean
    peeking_prev: boolean
    resuming: boolean
    seeking: boolean
    skipping_next: boolean
    skipping_prev: boolean
  }
  paused: boolean
  position: number
  repeat_mode: number
  shuffle: boolean
  track_window: {
    current_track: SpotifyTrack
    previous_tracks: SpotifyTrack[]
    next_tracks: SpotifyTrack[]
  }
}

interface SpotifyTrack {
  uri: string
  id: string
  type: string
  media_type: string
  name: string
  is_playable: boolean
  duration_ms: number
  album: {
    uri: string
    name: string
    images: Array<{ url: string; height: number; width: number }>
  }
  artists: Array<{ uri: string; name: string }>
}

interface SpotifyState {
  // SDK state
  isSDKReady: boolean
  player: SpotifyPlayer | null
  deviceId: string | null

  // Auth state
  accessToken: string | null
  isAuthenticated: boolean

  // Playback state
  isPlaying: boolean
  currentTrack: SpotifyTrack | null
  position: number
  duration: number

  // UI state
  error: string | null
  isConnecting: boolean

  // Actions
  initializeSDK: () => Promise<void>
  setAccessToken: (token: string) => void
  connect: () => Promise<boolean>
  disconnect: () => void
  play: (uri?: string) => Promise<void>
  pause: () => Promise<void>
  togglePlay: () => Promise<void>
  seek: (position: number) => Promise<void>
  nextTrack: () => Promise<void>
  previousTrack: () => Promise<void>
  searchTracks: (query: string) => Promise<SpotifySearchResult[]>
  setError: (error: string | null) => void
}

interface SpotifySearchResult {
  id: string
  name: string
  artists: string
  album: string
  albumArt: string
  uri: string
  duration: number
}

// Spotify OAuth configuration
// Users need to register their own app at https://developer.spotify.com/dashboard
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ')

export const getSpotifyAuthUrl = (clientId: string, redirectUri: string): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    show_dialog: 'false',
  })
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`
}

// Parse access token from URL hash after OAuth redirect
export const parseSpotifyCallback = (): string | null => {
  const hash = window.location.hash.substring(1)
  const params = new URLSearchParams(hash)
  const token = params.get('access_token')
  if (token) {
    // Clear the hash from URL
    window.history.replaceState(null, '', window.location.pathname)
  }
  return token
}

export const useSpotifyStore = create<SpotifyState>((set, get) => ({
  isSDKReady: false,
  player: null,
  deviceId: null,
  accessToken: null,
  isAuthenticated: false,
  isPlaying: false,
  currentTrack: null,
  position: 0,
  duration: 0,
  error: null,
  isConnecting: false,

  initializeSDK: async () => {
    // Check if SDK is already loaded
    if (window.Spotify) {
      set({ isSDKReady: true })
      return
    }

    // Load Spotify Web Playback SDK
    return new Promise<void>((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true

      window.onSpotifyWebPlaybackSDKReady = () => {
        set({ isSDKReady: true })
        resolve()
      }

      document.body.appendChild(script)
    })
  },

  setAccessToken: (token: string) => {
    set({ accessToken: token, isAuthenticated: true })
    // Store token in localStorage for persistence
    localStorage.setItem('spotify_access_token', token)
  },

  connect: async () => {
    const { accessToken, isSDKReady } = get()

    if (!accessToken) {
      set({ error: 'No access token. Please authenticate with Spotify first.' })
      return false
    }

    if (!isSDKReady) {
      await get().initializeSDK()
    }

    set({ isConnecting: true, error: null })

    try {
      const player = new window.Spotify.Player({
        name: 'Cosmic Audio Visualizer',
        getOAuthToken: (cb) => cb(accessToken),
        volume: 0.5,
      })

      // Error handling
      player.addListener('initialization_error', ((data: { message: string }) => {
        set({ error: `Initialization error: ${data.message}`, isConnecting: false })
      }) as (state: unknown) => void)

      player.addListener('authentication_error', ((data: { message: string }) => {
        set({ error: `Authentication error: ${data.message}. Please re-authenticate.`, isConnecting: false, isAuthenticated: false })
        localStorage.removeItem('spotify_access_token')
      }) as (state: unknown) => void)

      player.addListener('account_error', ((data: { message: string }) => {
        set({ error: `Account error: ${data.message}. Spotify Premium is required.`, isConnecting: false })
      }) as (state: unknown) => void)

      player.addListener('playback_error', ((data: { message: string }) => {
        set({ error: `Playback error: ${data.message}` })
      }) as (state: unknown) => void)

      // Ready
      player.addListener('ready', ((data: { device_id: string }) => {
        console.log('Spotify player ready with Device ID:', data.device_id)
        set({ deviceId: data.device_id, isConnecting: false, player })
      }) as (state: unknown) => void)

      // Not Ready
      player.addListener('not_ready', ((data: { device_id: string }) => {
        console.log('Device ID has gone offline:', data.device_id)
        set({ deviceId: null })
      }) as (state: unknown) => void)

      // State changes
      player.addListener('player_state_changed', ((state: SpotifyPlaybackState | null) => {
        if (!state) return

        set({
          isPlaying: !state.paused,
          currentTrack: state.track_window.current_track,
          position: state.position,
          duration: state.track_window.current_track?.duration_ms || 0,
        })
      }) as (state: unknown) => void)

      const connected = await player.connect()
      if (!connected) {
        set({ error: 'Failed to connect to Spotify', isConnecting: false })
        return false
      }

      return true
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize Spotify player',
        isConnecting: false,
      })
      return false
    }
  },

  disconnect: () => {
    const { player } = get()
    if (player) {
      player.disconnect()
    }
    set({
      player: null,
      deviceId: null,
      isPlaying: false,
      currentTrack: null,
    })
  },

  play: async (uri?: string) => {
    const { accessToken, deviceId } = get()
    if (!accessToken || !deviceId) {
      set({ error: 'Not connected to Spotify' })
      return
    }

    try {
      const body: Record<string, unknown> = {}
      if (uri) {
        body.uris = [uri]
      }

      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      })
    } catch (error) {
      set({ error: 'Failed to start playback' })
    }
  },

  pause: async () => {
    const { player } = get()
    if (player) {
      await player.pause()
    }
  },

  togglePlay: async () => {
    const { player } = get()
    if (player) {
      await player.togglePlay()
    }
  },

  seek: async (position: number) => {
    const { player } = get()
    if (player) {
      await player.seek(position)
    }
  },

  nextTrack: async () => {
    const { player } = get()
    if (player) {
      await player.nextTrack()
    }
  },

  previousTrack: async () => {
    const { player } = get()
    if (player) {
      await player.previousTrack()
    }
  },

  searchTracks: async (query: string): Promise<SpotifySearchResult[]> => {
    const { accessToken } = get()
    if (!accessToken) {
      return []
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      return data.tracks.items.map((track: {
        id: string
        name: string
        artists: Array<{ name: string }>
        album: { name: string; images: Array<{ url: string }> }
        uri: string
        duration_ms: number
      }) => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((a) => a.name).join(', '),
        album: track.album.name,
        albumArt: track.album.images[0]?.url || '',
        uri: track.uri,
        duration: track.duration_ms,
      }))
    } catch {
      return []
    }
  },

  setError: (error: string | null) => set({ error }),
}))

// Helper to check for stored token on app load
export const initSpotifyAuth = (): string | null => {
  // First check for callback token
  const callbackToken = parseSpotifyCallback()
  if (callbackToken) {
    return callbackToken
  }

  // Then check localStorage
  return localStorage.getItem('spotify_access_token')
}
