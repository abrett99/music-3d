import { create } from 'zustand'

// MusicKit JS types
declare global {
  interface Window {
    MusicKit: MusicKitStatic
  }
}

interface MusicKitStatic {
  configure: (config: MusicKitConfig) => Promise<MusicKitInstance>
  getInstance: () => MusicKitInstance | undefined
}

interface MusicKitConfig {
  developerToken: string
  app: {
    name: string
    build: string
  }
}

interface MusicKitInstance {
  authorize: () => Promise<string>
  unauthorize: () => Promise<void>
  isAuthorized: boolean
  musicUserToken: string
  player: MusicKitPlayer
  api: MusicKitAPI
}

interface MusicKitPlayer {
  play: () => Promise<void>
  pause: () => void
  stop: () => void
  skipToNextItem: () => Promise<void>
  skipToPreviousItem: () => Promise<void>
  seekToTime: (time: number) => Promise<void>
  volume: number
  currentPlaybackTime: number
  currentPlaybackDuration: number
  isPlaying: boolean
  nowPlayingItem: MusicKitMediaItem | null
  queue: {
    setQueue: (options: { songs: string[] }) => Promise<void>
  }
  addEventListener: (event: string, callback: () => void) => void
  removeEventListener: (event: string, callback: () => void) => void
}

interface MusicKitAPI {
  search: (query: string, options: { types: string[]; limit: number }) => Promise<MusicKitSearchResults>
}

interface MusicKitSearchResults {
  songs?: {
    data: MusicKitMediaItem[]
  }
}

interface MusicKitMediaItem {
  id: string
  type: string
  attributes: {
    name: string
    artistName: string
    albumName: string
    artwork: {
      url: string
      width: number
      height: number
    }
    durationInMillis: number
  }
}

interface AppleMusicState {
  // SDK state
  isSDKReady: boolean
  instance: MusicKitInstance | null

  // Auth state
  developerToken: string | null
  isAuthenticated: boolean

  // Playback state
  isPlaying: boolean
  currentTrack: AppleMusicTrack | null
  position: number
  duration: number

  // UI state
  error: string | null
  isConnecting: boolean

  // Actions
  initializeSDK: (developerToken: string) => Promise<void>
  authorize: () => Promise<boolean>
  disconnect: () => Promise<void>
  play: (songId?: string) => Promise<void>
  pause: () => void
  togglePlay: () => Promise<void>
  seek: (position: number) => Promise<void>
  nextTrack: () => Promise<void>
  previousTrack: () => Promise<void>
  searchTracks: (query: string) => Promise<AppleMusicSearchResult[]>
  setError: (error: string | null) => void
  setDeveloperToken: (token: string) => void
}

interface AppleMusicTrack {
  id: string
  name: string
  artistName: string
  albumName: string
  artworkUrl: string
  duration: number
}

interface AppleMusicSearchResult {
  id: string
  name: string
  artists: string
  album: string
  albumArt: string
  duration: number
}

export const useAppleMusicStore = create<AppleMusicState>((set, get) => ({
  isSDKReady: false,
  instance: null,
  developerToken: null,
  isAuthenticated: false,
  isPlaying: false,
  currentTrack: null,
  position: 0,
  duration: 0,
  error: null,
  isConnecting: false,

  initializeSDK: async (developerToken: string) => {
    set({ developerToken })
    localStorage.setItem('apple_music_developer_token', developerToken)

    // Check if SDK is already loaded
    if (window.MusicKit) {
      try {
        const instance = await window.MusicKit.configure({
          developerToken,
          app: {
            name: 'Cosmic Audio Visualizer',
            build: '1.0.0',
          },
        })

        set({ isSDKReady: true, instance })

        // Set up event listeners
        instance.player.addEventListener('playbackStateDidChange', () => {
          const player = instance.player
          set({
            isPlaying: player.isPlaying,
            position: player.currentPlaybackTime * 1000,
            duration: player.currentPlaybackDuration * 1000,
          })
        })

        instance.player.addEventListener('nowPlayingItemDidChange', () => {
          const item = instance.player.nowPlayingItem
          if (item) {
            set({
              currentTrack: {
                id: item.id,
                name: item.attributes.name,
                artistName: item.attributes.artistName,
                albumName: item.attributes.albumName,
                artworkUrl: item.attributes.artwork.url
                  .replace('{w}', '300')
                  .replace('{h}', '300'),
                duration: item.attributes.durationInMillis,
              },
            })
          } else {
            set({ currentTrack: null })
          }
        })

        return
      } catch (error) {
        set({ error: 'Failed to configure MusicKit. Please check your developer token.' })
        return
      }
    }

    // Load MusicKit JS SDK
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js'
      script.async = true
      script.setAttribute('data-web-components', '')

      script.onload = async () => {
        try {
          const instance = await window.MusicKit.configure({
            developerToken,
            app: {
              name: 'Cosmic Audio Visualizer',
              build: '1.0.0',
            },
          })

          set({ isSDKReady: true, instance })

          // Set up event listeners
          instance.player.addEventListener('playbackStateDidChange', () => {
            const player = instance.player
            set({
              isPlaying: player.isPlaying,
              position: player.currentPlaybackTime * 1000,
              duration: player.currentPlaybackDuration * 1000,
            })
          })

          instance.player.addEventListener('nowPlayingItemDidChange', () => {
            const item = instance.player.nowPlayingItem
            if (item) {
              set({
                currentTrack: {
                  id: item.id,
                  name: item.attributes.name,
                  artistName: item.attributes.artistName,
                  albumName: item.attributes.albumName,
                  artworkUrl: item.attributes.artwork.url
                    .replace('{w}', '300')
                    .replace('{h}', '300'),
                  duration: item.attributes.durationInMillis,
                },
              })
            } else {
              set({ currentTrack: null })
            }
          })

          resolve()
        } catch (error) {
          set({ error: 'Failed to configure MusicKit' })
          reject(error)
        }
      }

      script.onerror = () => {
        set({ error: 'Failed to load Apple Music SDK' })
        reject(new Error('Failed to load script'))
      }

      document.body.appendChild(script)
    })
  },

  authorize: async () => {
    const { instance } = get()
    if (!instance) {
      set({ error: 'MusicKit not initialized. Please set your developer token first.' })
      return false
    }

    set({ isConnecting: true, error: null })

    try {
      await instance.authorize()
      set({ isAuthenticated: true, isConnecting: false })
      return true
    } catch (error) {
      set({
        error: 'Authorization failed. Please make sure you have an Apple Music subscription.',
        isConnecting: false,
      })
      return false
    }
  },

  disconnect: async () => {
    const { instance } = get()
    if (instance) {
      await instance.unauthorize()
    }
    set({
      isAuthenticated: false,
      isPlaying: false,
      currentTrack: null,
    })
  },

  play: async (songId?: string) => {
    const { instance } = get()
    if (!instance) {
      set({ error: 'Not connected to Apple Music' })
      return
    }

    try {
      if (songId) {
        await instance.player.queue.setQueue({ songs: [songId] })
      }
      await instance.player.play()
    } catch (error) {
      set({ error: 'Failed to start playback' })
    }
  },

  pause: () => {
    const { instance } = get()
    if (instance) {
      instance.player.pause()
    }
  },

  togglePlay: async () => {
    const { instance, isPlaying } = get()
    if (instance) {
      if (isPlaying) {
        instance.player.pause()
      } else {
        await instance.player.play()
      }
    }
  },

  seek: async (position: number) => {
    const { instance } = get()
    if (instance) {
      await instance.player.seekToTime(position / 1000) // Convert ms to seconds
    }
  },

  nextTrack: async () => {
    const { instance } = get()
    if (instance) {
      await instance.player.skipToNextItem()
    }
  },

  previousTrack: async () => {
    const { instance } = get()
    if (instance) {
      await instance.player.skipToPreviousItem()
    }
  },

  searchTracks: async (query: string): Promise<AppleMusicSearchResult[]> => {
    const { instance } = get()
    if (!instance) {
      return []
    }

    try {
      const results = await instance.api.search(query, {
        types: ['songs'],
        limit: 10,
      })

      if (!results.songs?.data) {
        return []
      }

      return results.songs.data.map((song) => ({
        id: song.id,
        name: song.attributes.name,
        artists: song.attributes.artistName,
        album: song.attributes.albumName,
        albumArt: song.attributes.artwork.url
          .replace('{w}', '100')
          .replace('{h}', '100'),
        duration: song.attributes.durationInMillis,
      }))
    } catch {
      return []
    }
  },

  setError: (error: string | null) => set({ error }),

  setDeveloperToken: (token: string) => {
    set({ developerToken: token })
    localStorage.setItem('apple_music_developer_token', token)
  },
}))

// Helper to get stored developer token
export const getStoredAppleMusicToken = (): string | null => {
  return localStorage.getItem('apple_music_developer_token')
}
