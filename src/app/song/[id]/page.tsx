'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import LyricsPanel from '@/components/LyricsPanel'
import LoopController from '@/components/LoopController'
import PhoneticToggle from '@/components/PhoneticToggle'
import YouTubePlayer from '@/components/YouTubePlayer'
import { useLyricsSync } from '@/hooks/useLyricsSync'
import type { SongWithLyrics, LyricLine } from '@/lib/types'

export default function SongPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [song, setSong] = useState<SongWithLyrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPhonetic, setShowPhonetic] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)

  const getCurrentTimeRef = useRef<(() => number) | null>(null)
  const seekToRef = useRef<((time: number) => void) | null>(null)

  const getCurrentTime = useCallback(() => getCurrentTimeRef.current?.() ?? 0, [])

  const { activeIndex, progress, loopLine, setLoopLine, registerSeek } = useLyricsSync(
    song?.lines ?? [],
    playerReady ? getCurrentTime : null,
    isPlaying
  )

  useEffect(() => {
    fetch(`/api/songs/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(setSong)
      .catch(() => setError('歌曲加载失败'))
  }, [id])

  const handleLineClick = (line: LyricLine) => {
    setLoopLine(line)
    seekToRef.current?.(line.time)
  }

  const handleSeekTo = useCallback((fn: (time: number) => void) => {
    seekToRef.current = fn
    registerSeek(fn)
  }, [registerSeek])

  const handleGetCurrentTime = useCallback((fn: () => number) => {
    getCurrentTimeRef.current = fn
    setPlayerReady(true)
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {error} <button onClick={() => router.push('/')} className="ml-4 underline">返回首页</button>
      </div>
    )
  }

  if (!song) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-700">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-gray-900 truncate">{song.title}</h1>
          <p className="text-xs text-gray-500">{song.artist}</p>
        </div>
        <PhoneticToggle showPhonetic={showPhonetic} onToggle={() => setShowPhonetic(v => !v)} />
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Player (left / top on mobile) */}
        <div className="w-full md:w-1/2 p-4 flex flex-col gap-4 shrink-0">
          <YouTubePlayer
            videoId={song.youtubeId}
            onSeekTo={handleSeekTo}
            onGetCurrentTime={handleGetCurrentTime}
            onPlayingChange={setIsPlaying}
          />
        </div>

        {/* Lyrics panel (right / bottom on mobile) */}
        <div className="flex-1 overflow-hidden border-l">
          <LyricsPanel
            lines={song.lines}
            activeIndex={activeIndex}
            progress={progress}
            loopLine={loopLine}
            showPhonetic={showPhonetic}
            onLineClick={handleLineClick}
          />
        </div>
      </div>

      {/* Loop controller bar */}
      <LoopController loopLine={loopLine} onExit={() => setLoopLine(null)} />
    </div>
  )
}
