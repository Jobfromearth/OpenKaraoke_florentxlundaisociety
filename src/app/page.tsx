'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SearchBar from '@/components/SearchBar'
import LogoVinyl from '@/components/LogoVinyl'
import { useUILang } from '@/components/UILangProvider'
import type { YouTubeSearchResult } from '@/lib/types'
import type { UILang } from '@/lib/i18n'

const SONG_LANG_CODES = ['en', 'ja', 'ko', 'es', 'sv']
const UI_LANGS: UILang[] = ['zh', 'en', 'sv']
const UI_LANG_LABELS: Record<UILang, string> = { zh: '中', en: 'EN', sv: 'SV' }

export default function HomePage() {
  const router = useRouter()
  const { t, lang, setLang } = useUILang()
  const [language, setLanguage] = useState('en')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (result: YouTubeSearchResult & { language: string }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeId: result.videoId,
          title: result.title,
          artist: result.channelTitle,
          language: result.language,
          thumbnailUrl: result.thumbnailUrl,
          durationSeconds: result.durationSeconds,
        }),
      })
      if (!res.ok && res.status !== 206) {
        const data = await res.json()
        if (data.error === 'lyrics_not_found') {
          setError(t.errorLyricsNotFound)
          setLoading(false)
          return
        }
        throw new Error(t.errorLoadFailed)
      }
      const song = await res.json()
      router.push(`/song/${song.id}`)
    } catch {
      setError(t.errorLoadFailed)
      setLoading(false)
    }
  }

  return (
    <main className="home-root">
      <div className="glow glow-amber" />
      <div className="glow glow-blue" />
      <div className="glow glow-rose" />

      <section className="hero">
        <div className="vinyl-stage">
          <div className="ripple ripple-1" />
          <div className="ripple ripple-2" />
          <div className="ripple ripple-3" />
          <div className="ripple ripple-4" />
          <LogoVinyl size={180} isPlaying={false} />
        </div>

        <h1 className="wordmark">OpenKaraoke</h1>
        <p className="tagline">{t.appSubtitle}</p>

        <div className="ui-lang-switcher">
          {UI_LANGS.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`ui-lang-btn${lang === l ? ' active' : ''}`}
            >
              {UI_LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </section>

      <section className="controls-card">
        <div className="lang-filter">
          <span className="lang-label">{t.songLanguageLabel}</span>
          <div className="lang-btns">
            {SONG_LANG_CODES.map(code => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className={`lang-btn${language === code ? ' active' : ''}`}
              >
                {t.songLanguages[code]}
              </button>
            ))}
          </div>
        </div>

        <SearchBar onSelect={handleSelect} language={language} />

        {loading && <p className="status-msg loading-msg">{t.loadingLyrics}</p>}
        {error && <p className="status-msg error-msg">{error}</p>}
      </section>
    </main>
  )
}
