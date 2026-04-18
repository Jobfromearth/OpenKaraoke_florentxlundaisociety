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

const PHONETIC_PROMPTS: Record<string, string> = {
  zh: `你是一个专业的外语歌曲音译助手。将歌词转写为中国人能"按汉字发音来模拟演唱"的中文音译。
要求：①贴近原语言发音 ②自然流畅可唱 ③按词/短语分组返回 segments。
只返回合法 JSON 数组，不含其他任何文字或代码块标记。`,
  en: `You are a phonetic transcription assistant for foreign-language song lyrics. Transcribe each lyric line into approximate English phonetic spellings that an English speaker can use to sing along.
Rules: ① Stay close to the original pronunciation ② Natural to sing ③ Return word/phrase-level segments.
Return only a valid JSON array with no other text or code fences.`,
  ja: `あなたはプロの外国語歌詞音訳アシスタントです。歌詞の各行をカタカナで読み仮名（音訳）に変換してください。日本語話者がそのまま歌えるように、原語の発音に忠実なカタカナ表記を使ってください。
要件：①原語の発音に忠実 ②歌いやすい ③単語・フレーズ単位でsegmentsに分けて返す。
有効なJSON配列のみ返し、他のテキストやコードフェンスを含めないこと。`,
  sv: `Du är en professionell fonetisk transkriptionsassistent för utländska låttexter. Transkribera varje textrad till fonetiska stavningar på svenska som en svensktalande person kan använda för att sjunga med.
Regler: ① Håll dig nära originalets uttal ② Naturlig att sjunga ③ Returnera segment på ord-/frasnivå.
Returnera endast en giltig JSON-array utan annan text eller kodstängsel.`,
}

async function generatePhonetics(
  language: string,
  phoneticLang: string,
  lines: { index: number; text: string }[]
): Promise<{ index: number; phonetic: string; segments: { original: string; phonetic: string }[] }[]> {
  const systemPrompt = PHONETIC_PROMPTS[phoneticLang] ?? PHONETIC_PROMPTS.zh
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: JSON.stringify({ language, lines }),
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : null
  if (!text) throw new Error('Claude returned no text content')
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(clean)
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
  let body: { youtubeId: string; title: string; artist: string; language: string; phoneticLang?: string; thumbnailUrl: string; durationSeconds: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { youtubeId, title, artist, language, thumbnailUrl, durationSeconds } = body
  const phoneticLang = body.phoneticLang ?? 'zh'
  const VALID_PHONETIC_LANGS = ['zh', 'en', 'ja', 'sv']
  if (!VALID_PHONETIC_LANGS.includes(phoneticLang)) {
    return NextResponse.json({ error: 'Invalid phoneticLang' }, { status: 400 })
  }

  // Return cached result if exists
  const existing = await prisma.song.findUnique({
    where: { youtubeId },
    include: { lyrics: true },
  })
  const cachedLyrics = existing?.lyrics.find(l => l.phoneticLang === phoneticLang)
  if (cachedLyrics) {
    try {
      const lines = JSON.parse(cachedLyrics.lines) as LyricLine[]
      return NextResponse.json({ ...existing, createdAt: existing!.createdAt.toISOString(), lines })
    } catch {
      // Corrupted cached data — fall through to re-generate
    }
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
    return NextResponse.json({ error: 'lyrics_not_found' }, { status: 404 })
  }

  const rawLines = parseLRC(lrcText)

  // Generate phonetics with Claude
  let phoneticData: { index: number; phonetic: string; segments: { original: string; phonetic: string }[] }[]
  try {
    phoneticData = await generatePhonetics(
      language,
      phoneticLang,
      rawLines.map((line, i) => ({ index: i, text: line.text }))
    )
  } catch (claudeError) {
    console.error('Claude phonetics generation failed:', claudeError)
    const fallbackLines: LyricLine[] = rawLines.map(line => ({ ...line, phonetic: '', segments: [] }))
    try {
      await prisma.lyrics.create({ data: { songId: song.id, phoneticLang, lines: JSON.stringify(fallbackLines) } })
    } catch (dbError) {
      console.error('Failed to save fallback lyrics:', dbError)
    }
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

  await prisma.lyrics.create({ data: { songId: song.id, phoneticLang, lines: JSON.stringify(lines) } })

  return NextResponse.json({ ...song, createdAt: song.createdAt.toISOString(), lines })
}
