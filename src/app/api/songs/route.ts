import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { parseLRC } from '@/lib/lrc-parser'
import type { LyricLine, Segment } from '@/lib/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function fetchLRC(title: string, artist: string, durationSeconds: number): Promise<string | null> {
  const url = new URL('https://lrclib.net/api/get')
  url.searchParams.set('track_name', title)
  url.searchParams.set('artist_name', artist)
  url.searchParams.set('duration', String(durationSeconds))
  const res = await fetch(url.toString(), { headers: { 'Lrclib-Client': 'foreign-song-learner v0.1' } })
  if (!res.ok) return null
  const data = await res.json()
  return data.syncedLyrics ?? null
}

async function generatePhonetics(
  language: string,
  lines: { index: number; text: string }[]
): Promise<{ index: number; phonetic: string; segments: { original: string; phonetic: string }[] }[]> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `你是一个专业的外语歌曲音译助手。将歌词转写为中国人能"按汉字发音来模拟演唱"的中文音译。
要求：①贴近原语言发音 ②自然流畅可唱 ③按词/短语分组返回 segments。
只返回合法 JSON 数组，不含其他任何文字或代码块标记。`,
    messages: [{
      role: 'user',
      content: JSON.stringify({ language, lines }),
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  return JSON.parse(text)
}

// GET /api/songs — list saved songs
export async function GET() {
  const songs = await prisma.song.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      youtubeId: true,
      title: true,
      artist: true,
      language: true,
      thumbnailUrl: true,
      durationSeconds: true,
      createdAt: true,
    },
  })
  return NextResponse.json(songs)
}

// POST /api/songs — create or retrieve song with lyrics+phonetics
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    youtubeId: string
    title: string
    artist: string
    language: string
    thumbnailUrl: string
    durationSeconds: number
  }

  const { youtubeId, title, artist, language, thumbnailUrl, durationSeconds } = body

  // Return cached result if exists
  const existing = await prisma.song.findUnique({
    where: { youtubeId },
    include: { lyrics: true },
  })
  if (existing?.lyrics) {
    return NextResponse.json({
      ...existing,
      createdAt: existing.createdAt.toISOString(),
      lines: JSON.parse(existing.lyrics.lines) as LyricLine[],
    })
  }

  // Create or get song record
  const song = await prisma.song.upsert({
    where: { youtubeId },
    update: {},
    create: { youtubeId, title, artist, language, thumbnailUrl, durationSeconds },
  })

  // Fetch LRC lyrics
  const lrcText = await fetchLRC(title, artist, durationSeconds)
  if (!lrcText) {
    return NextResponse.json({ error: 'lyrics_not_found', song: { ...song, createdAt: song.createdAt.toISOString() } }, { status: 404 })
  }

  const rawLines = parseLRC(lrcText)

  // Generate phonetics with Claude
  let phoneticData: { index: number; phonetic: string; segments: { original: string; phonetic: string }[] }[]
  try {
    phoneticData = await generatePhonetics(
      language,
      rawLines.map((line, i) => ({ index: i, text: line.text }))
    )
  } catch {
    // Save lines without phonetics on failure
    const fallbackLines: LyricLine[] = rawLines.map(line => ({
      ...line,
      phonetic: '',
      segments: [],
    }))
    await prisma.lyrics.create({ data: { songId: song.id, lines: JSON.stringify(fallbackLines) } })
    return NextResponse.json(
      { error: 'phonetics_failed', song: { ...song, createdAt: song.createdAt.toISOString() }, lines: fallbackLines },
      { status: 206 }
    )
  }

  // Merge phonetics into lines
  const COLORS = [0, 1, 2, 3, 4]
  const lines: LyricLine[] = rawLines.map((line, i) => {
    const pd = phoneticData.find(p => p.index === i)
    if (!pd) return { ...line, phonetic: '', segments: [] }
    const segments: Segment[] = pd.segments.map((seg, j) => ({
      original: seg.original,
      phonetic: seg.phonetic,
      color: COLORS[j % COLORS.length],
    }))
    return { ...line, phonetic: pd.phonetic, segments }
  })

  await prisma.lyrics.create({ data: { songId: song.id, lines: JSON.stringify(lines) } })

  return NextResponse.json({ ...song, createdAt: song.createdAt.toISOString(), lines })
}
