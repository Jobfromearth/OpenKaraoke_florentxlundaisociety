import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { LyricLine } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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
  if (song.lyrics) {
    try {
      lines = JSON.parse(song.lyrics.lines) as LyricLine[]
    } catch {
      lines = []
    }
  }

  return NextResponse.json({ ...song, createdAt: song.createdAt.toISOString(), lines })
}
