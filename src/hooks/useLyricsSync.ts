import { useEffect, useRef, useState } from 'react'
import type { LyricLine } from '@/lib/types'

export function useLyricsSync(
  lines: LyricLine[],
  getCurrentTime: (() => number) | null,
  isPlaying: boolean
) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [progress, setProgress] = useState(0)   // 0–1 within active line
  const [loopLine, setLoopLine] = useState<LyricLine | null>(null)
  const seekRef = useRef<((time: number) => void) | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Register seekTo from YouTubePlayer
  const registerSeek = (fn: (time: number) => void) => {
    seekRef.current = fn
  }

  useEffect(() => {
    if (!isPlaying || !getCurrentTime) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      const currentTime = getCurrentTime()

      // Loop enforcement
      if (loopLine && currentTime >= loopLine.endTime) {
        seekRef.current?.(loopLine.time)
        return
      }

      // Find active line (last line whose start time <= currentTime)
      let idx = -1
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].time <= currentTime) { idx = i; break }
      }
      setActiveIndex(idx)

      if (idx >= 0) {
        const line = lines[idx]
        const lineProgress = Math.min(
          (currentTime - line.time) / Math.max(line.endTime - line.time, 0.001),
          1
        )
        setProgress(lineProgress)
      }
    }, 100)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [lines, getCurrentTime, isPlaying, loopLine])

  return { activeIndex, progress, loopLine, setLoopLine, registerSeek }
}
