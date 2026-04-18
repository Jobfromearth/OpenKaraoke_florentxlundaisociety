import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { LyricLine } from '@/lib/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const phoneticLang = req.nextUrl.searchParams.get('phoneticLang') ?? 'zh'

  let song
  try {
    song = await prisma.song.findUnique({
      where: { id },
      include: { lyrics: true },
    })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!song) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let lines: LyricLine[] = []
  const matchedLyrics = song.lyrics.find(l => l.phoneticLang === phoneticLang)
    ?? song.lyrics[0]
  if (matchedLyrics) {
    try {
      lines = JSON.parse(matchedLyrics.lines) as LyricLine[]
    } catch {
      lines = []
    }
  }

  return NextResponse.json({ ...song, createdAt: song.createdAt.toISOString(), lines })
}
