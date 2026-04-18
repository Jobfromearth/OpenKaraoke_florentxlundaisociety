'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import LyricsPanel from '@/components/LyricsPanel'
import LoopController from '@/components/LoopController'
import PhoneticToggle from '@/components/PhoneticToggle'
import TranslationToggle from '@/components/TranslationToggle'
import YouTubePlayer from '@/components/YouTubePlayer'
import PitchVisualizer from '@/components/PitchVisualizer'
import LogoVinyl from '@/components/LogoVinyl'
import MixerDrawer from '@/components/MixerDrawer'
import { useLyricsSync } from '@/hooks/useLyricsSync'
import { useAudioMixer } from '@/hooks/useAudioMixer'
import { useUILang } from '@/components/UILangProvider'
import type { SongWithLyrics, LyricLine } from '@/lib/types'

export default function SongPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useUILang()
  const mixer = useAudioMixer()
  const [song, setSong] = useState<SongWithLyrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPhonetic, setShowPhonetic] = useState(true)
  const [showTranslation, setShowTranslation] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [phoneticWarning, setPhoneticWarning] = useState(false)

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
      .then((data: SongWithLyrics) => {
        setSong(data)
        if (data.lines?.length > 0 && data.lines.every(l => !l.phonetic?.trim())) {
          setPhoneticWarning(true)
        }
      })
      .catch(() => setError(t.songLoadError))
  }, [id])

  useEffect(() => {
    mixer.initMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      <div
        className="min-h-screen flex items-center justify-center gap-3"
        style={{ background: 'var(--color-bg)' }}
      >
        <span className="text-sm" style={{ color: '#F87171' }}>{error}</span>
        <button
          onClick={() => router.push('/')}
          className="text-xs underline transition-opacity hover:opacity-60"
          style={{ color: 'var(--color-text-3)' }}
        >
          {t.backToHome}
        </button>
      </div>
    )
  }

  if (!song) {
    return (
      <div
        className="min-h-screen flex items-center justify-center gap-3"
        style={{ background: 'var(--color-bg)' }}
      >
        <div className="spinner" />
        <span className="text-sm" style={{ color: 'var(--color-text-3)' }}>{t.loading}</span>
      </div>
    )
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Header */}
      <header
        className="shrink-0 px-4 py-2.5 flex items-center gap-3"
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <button
          onClick={() => router.push('/')}
          className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-all duration-150 hover:brightness-125"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--color-text-2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <LogoVinyl size={34} isPlaying={isPlaying} />

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>
            {song.title}
          </h1>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-3)' }}>
            {song.artist}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PhoneticToggle showPhonetic={showPhonetic} onToggle={() => setShowPhonetic(v => !v)} />
          <TranslationToggle showTranslation={showTranslation} onToggle={() => setShowTranslation(v => !v)} />
        </div>
      </header>

      {/* Phonetics empty warning */}
      {phoneticWarning && (
        <div
          className="shrink-0 text-xs text-center px-4 py-1.5"
          style={{ color: '#F87171', background: 'rgba(248,113,113,0.08)', borderBottom: '1px solid rgba(248,113,113,0.18)' }}
        >
          {t.errorPhoneticsFailed}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Player panel */}
        <div
          className="shrink-0 md:w-1/2 p-3 md:p-4 flex flex-col"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <YouTubePlayer
            videoId={song.youtubeId}
            onSeekTo={handleSeekTo}
            onGetCurrentTime={handleGetCurrentTime}
            onPlayingChange={setIsPlaying}
          />
          <div
            className="mt-2 rounded-lg overflow-hidden flex-1"
            style={{
              minHeight: '80px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <PitchVisualizer analyserNode={mixer.analyserNode} />
          </div>
        </div>

        {/* Lyrics panel */}
        <div className="flex-1 overflow-hidden min-h-0">
          <LyricsPanel
            lines={song.lines}
            activeIndex={activeIndex}
            progress={progress}
            loopLine={loopLine}
            showPhonetic={showPhonetic}
            showTranslation={showTranslation}
            onLineClick={handleLineClick}
          />
        </div>
      </div>

      <LoopController loopLine={loopLine} onExit={() => setLoopLine(null)} />
      <MixerDrawer mixer={mixer} />
    </div>
  )
}
