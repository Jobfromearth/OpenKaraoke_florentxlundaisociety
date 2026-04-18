import { NextRequest, NextResponse } from 'next/server'
import type { YouTubeSearchResult } from '@/lib/types'

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] ?? '0', 10)
  const minutes = parseInt(match[2] ?? '0', 10)
  const seconds = parseInt(match[3] ?? '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Missing YOUTUBE_API_KEY' }, { status: 500 })

  // Step 1: Search for videos
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('q', q)
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('videoCategoryId', '10') // Music category
  searchUrl.searchParams.set('maxResults', '8')
  searchUrl.searchParams.set('key', apiKey)

  const searchRes = await fetch(searchUrl.toString())
  if (!searchRes.ok) {
    const body = await searchRes.json().catch(() => null)
    console.error('YouTube search API error:', searchRes.status, JSON.stringify(body))
    return NextResponse.json({ error: 'YouTube search failed', details: body }, { status: 502 })
  }
  const searchData = await searchRes.json()
  const items = searchData.items ?? []
  const videoIds: string[] = items.map((item: { id: { videoId: string } }) => item.id.videoId)

  if (videoIds.length === 0) return NextResponse.json([])

  // Step 2: Get video durations
  const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  detailsUrl.searchParams.set('part', 'contentDetails')
  detailsUrl.searchParams.set('id', videoIds.join(','))
  detailsUrl.searchParams.set('key', apiKey)

  const detailsRes = await fetch(detailsUrl.toString())
  const durationMap: Record<string, number> = {}
  if (detailsRes.ok) {
    const detailsData = await detailsRes.json()
    for (const item of detailsData.items ?? []) {
      durationMap[item.id] = parseISO8601Duration(item.contentDetails?.duration ?? '')
    }
  }

  const results: YouTubeSearchResult[] = items.map((item: {
    id: { videoId: string }
    snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } }
  }) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails.medium.url,
    durationSeconds: durationMap[item.id.videoId] ?? 0,
  }))

  return NextResponse.json(results)
}
