import type { LyricLine } from './types'

type RawLine = { time: number; text: string }

export function parseLRC(lrc: string): Omit<LyricLine, 'phonetic' | 'segments'>[] {
  const lineRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/
  const raw: RawLine[] = []

  for (const line of lrc.split('\n')) {
    const match = line.trim().match(lineRegex)
    if (!match) continue
    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const ms = parseInt(match[3].padEnd(3, '0'), 10)
    const time = minutes * 60 + seconds + ms / 1000
    const text = match[4]
      .replace(/\[[\d:.]+\]/g, '')   // strip extra [mm:ss.cs] tags (multi-timestamp lines)
      .replace(/<[\d:.]+>/g, '')     // strip <mm:ss.cs> word-level tags (enhanced LRC)
      .trim()
    if (text) raw.push({ time, text })
  }

  raw.sort((a, b) => a.time - b.time)

  return raw.map((line, i) => ({
    time: line.time,
    endTime: raw[i + 1]?.time ?? line.time + 5,
    text: line.text,
  }))
}
