import type { VercelRequest, VercelResponse } from '@vercel/node'

// Using cobalt.tools API - a free, open-source YouTube audio extraction service
// This avoids needing to bundle yt-dlp in serverless (which has size limits)
const COBALT_API = 'https://api.cobalt.tools/api/json'

interface CobaltResponse {
  status: string
  url?: string
  audio?: string
  error?: string
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
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3',
        isAudioOnly: true,
        isNoTTWatermark: true,
        isTTFullAudio: true,
        disableMetadata: false,
      }),
    })

    const data: CobaltResponse = await response.json()

    if (data.status === 'error' || data.error) {
      return res.status(400).json({
        error: data.error || 'Failed to extract audio'
      })
    }

    // cobalt returns either 'url' or 'audio' depending on the response type
    const audioUrl = data.url || data.audio

    if (!audioUrl) {
      return res.status(400).json({ error: 'No audio URL in response' })
    }

    return res.status(200).json({
      success: true,
      audioUrl: audioUrl
    })

  } catch (error) {
    console.error('YouTube extraction error:', error)
    return res.status(500).json({
      error: 'Failed to extract audio from YouTube'
    })
  }
}
