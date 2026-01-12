import type { VercelRequest, VercelResponse } from '@vercel/node'

// Using cobalt API - updated to new API format
// Note: YouTube extraction may be unreliable due to YouTube's countermeasures
// Consider using local files, Spotify, or Apple Music as alternatives
const COBALT_API = 'https://api.cobalt.tools'

interface CobaltResponse {
  status: 'error' | 'tunnel' | 'redirect' | 'picker' | 'stream'
  url?: string
  audio?: string
  error?: {
    code: string
    context?: {
      service?: string
    }
  }
  text?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'URL is required' })
  }

  // Validate YouTube URL
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/
  if (!youtubeRegex.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' })
  }

  try {
    const response = await fetch(COBALT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        downloadMode: 'audio',
        audioFormat: 'mp3',
        audioBitrate: '128',
      }),
    })

    if (!response.ok) {
      // Check for specific error responses
      const errorText = await response.text()
      console.error('Cobalt API error response:', errorText)

      return res.status(503).json({
        error: 'YouTube extraction is temporarily unavailable. YouTube has implemented restrictions that affect this service. Please try using a local file, Spotify, or Apple Music instead.',
        code: 'YOUTUBE_UNAVAILABLE'
      })
    }

    const data: CobaltResponse = await response.json()

    if (data.status === 'error') {
      const errorCode = data.error?.code || 'unknown'

      // Provide user-friendly error messages
      if (errorCode.includes('youtube') || data.error?.context?.service === 'youtube') {
        return res.status(503).json({
          error: 'YouTube extraction is temporarily unavailable due to service restrictions. Please try using a local file, Spotify, or Apple Music instead.',
          code: 'YOUTUBE_UNAVAILABLE'
        })
      }

      return res.status(400).json({
        error: data.text || 'Failed to extract audio',
        code: errorCode
      })
    }

    // cobalt returns url in various status types
    const audioUrl = data.url || data.audio

    if (!audioUrl) {
      return res.status(400).json({
        error: 'No audio URL returned. The service may be experiencing issues.',
        code: 'NO_AUDIO_URL'
      })
    }

    return res.status(200).json({
      success: true,
      audioUrl: audioUrl
    })

  } catch (error) {
    console.error('YouTube extraction error:', error)
    return res.status(500).json({
      error: 'YouTube extraction failed. This feature is currently unreliable due to service restrictions. Please try using a local file, Spotify, or Apple Music instead.',
      code: 'EXTRACTION_FAILED'
    })
  }
}
