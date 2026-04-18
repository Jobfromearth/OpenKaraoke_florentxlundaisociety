import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { parseLRC } from '@/lib/lrc-parser'
import type { LyricLine, Segment, PhoneticLang } from '@/lib/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function fetchLRC(title: string, artist: string, durationSeconds: number, query?: string): Promise<string | null> {
  // Try exact match first (title + artist + duration)
  const getUrl = new URL('https://lrclib.net/api/get')
  getUrl.searchParams.set('track_name', title)
  getUrl.searchParams.set('artist_name', artist)
  getUrl.searchParams.set('duration', String(durationSeconds))
  const getRes = await fetch(getUrl.toString(), { headers: { 'Lrclib-Client': 'foreign-song-learner v0.1' } })
  if (getRes.ok) {
    const data = await getRes.json()
    if (data.syncedLyrics) return data.syncedLyrics
  }

  // Fallback: search by user query or title
  const searchUrl = new URL('https://lrclib.net/api/search')
  searchUrl.searchParams.set('track_name', (query ?? title).toLowerCase())
  const searchRes = await fetch(searchUrl.toString(), { headers: { 'Lrclib-Client': 'foreign-song-learner v0.1' } })
  if (!searchRes.ok) return null
  const results: { syncedLyrics?: string }[] = await searchRes.json()
  return results.find(r => r.syncedLyrics)?.syncedLyrics ?? null
}

const JSON_SCHEMA = `Each element must follow this exact schema:
{"index":<number>,"phonetic":"<full line transcription>","translation":"<natural translation into the target language>","segments":[{"original":"<word or phrase>","phonetic":"<transcription>"}]}
Return ONLY the JSON array. No explanation, no markdown fences.`

const PHONETIC_PROMPTS: Record<string, string> = {
  zh: `你是一个专业的外语歌曲音译助手。无论歌词是什么语言，都将每行转写为中国人能"按汉字发音来模拟演唱"的中文音译。
要求：①输出必须全部是汉字，绝对不能使用原语言文字（不管是日文假名、英文字母还是其他文字）②贴近原语言发音 ③自然流畅可唱 ④按词/短语分组返回 segments。
例如日语"大都会に"的中文音译应是"欧托卡伊尼"。
${JSON_SCHEMA}`,
  en: `You are a phonetic transcription assistant. Regardless of the source language, transcribe each lyric line into approximate English phonetic spellings that an English speaker can sing along with.
Rules: ① Output MUST use only English/Latin letters — never use the source language's native script (no kanji, kana, hangul, etc.) ② Stay close to the original pronunciation ③ Natural to sing ④ Return word/phrase-level segments.
Example: Japanese "大都会に" → "oh-toh-kah-ee nee".
${JSON_SCHEMA}`,
  ja: `あなたはプロの歌詞音訳アシスタントです。歌詞の言語に関わらず、各行をカタカナに変換してください。
要件：①出力は必ずカタカナのみ（ひらがな・漢字・ラテン文字など一切使用不可）②原語の発音に忠実 ③歌いやすい ④単語・フレーズ単位でsegmentsに分けて返す。
${JSON_SCHEMA}`,
  sv: `Du är en professionell fonetisk transkriptionsassistent. Oavsett källspråk, transkribera varje textrad till fonetiska stavningar på svenska som en svensktalande person kan sjunga med.
Regler: ① Utdata MÅSTE använda BARA svenska/latinska bokstäver — använd aldrig källspråkets egna skrift (inga kanji, kana, hangul, etc.) ② Håll dig nära originalets uttal ③ Naturlig att sjunga ④ Returnera segment på ord-/frasnivå.
Exempel: japanska "大都会に" → "oh-to-kai-i nii".
${JSON_SCHEMA}`,
}

const VALID_PHONETIC_LANGS = Object.keys(PHONETIC_PROMPTS)

async function generatePhonetics(
  language: string,
  phoneticLang: PhoneticLang,
  lines: { index: number; text: string }[]
): Promise<{ index: number; phonetic: string; translation: string; segments: { original: string; phonetic: string }[] }[]> {
  const systemPrompt = PHONETIC_PROMPTS[phoneticLang]
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: JSON.stringify({ language, lines }),
    }],
  })

  if (response.stop_reason === 'max_tokens') throw new Error('Claude response truncated (max_tokens reached)')
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
  let body: { youtubeId: string; title: string; artist: string; language: string; phoneticLang?: string; lrcQuery?: string; thumbnailUrl: string; durationSeconds: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { youtubeId, title, artist, language, thumbnailUrl, durationSeconds } = body
  const phoneticLang = body.phoneticLang ?? 'zh'
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
  const lrcText = await fetchLRC(title, artist, durationSeconds, body.lrcQuery)
  if (!lrcText) {
    return NextResponse.json({ error: 'lyrics_not_found' }, { status: 404 })
  }

  const rawLines = parseLRC(lrcText)

  // Generate phonetics with Claude
  let phoneticData: { index: number; phonetic: string; segments: { original: string; phonetic: string }[] }[]
  try {
    phoneticData = await generatePhonetics(
      language,
      phoneticLang as PhoneticLang,
      rawLines.map((line, i) => ({ index: i, text: line.text }))
    )
  } catch (claudeError) {
    console.error('Claude phonetics generation failed:', claudeError)
    const fallbackLines: LyricLine[] = rawLines.map(line => ({ ...line, phonetic: '', translation: '', segments: [] }))
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
    if (!pd || !pd.segments) return { ...line, phonetic: pd?.phonetic ?? '', translation: pd?.translation ?? '', segments: [] }
    const segments: Segment[] = pd.segments.map((seg, j) => ({
      original: seg.original,
      phonetic: seg.phonetic,
      color: COLORS[j % COLORS.length],
    }))
    return { ...line, phonetic: pd.phonetic, translation: pd.translation ?? '', segments }
  })

  await prisma.lyrics.create({ data: { songId: song.id, phoneticLang, lines: JSON.stringify(lines) } })

  return NextResponse.json({ ...song, createdAt: song.createdAt.toISOString(), lines })
}
