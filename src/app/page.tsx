'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SearchBar from '@/components/SearchBar'
import type { YouTubeSearchResult } from '@/lib/types'

const LANGUAGES = [
  { code: 'en', label: '英语' },
  { code: 'ja', label: '日语' },
  { code: 'ko', label: '韩语' },
  { code: 'es', label: '西班牙语' },
  { code: 'sv', label: '瑞典语' },
]

export default function HomePage() {
  const router = useRouter()
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
          setError('未找到该歌曲的歌词，请尝试其他版本')
          setLoading(false)
          return
        }
        throw new Error('创建失败')
      }
      const song = await res.json()
      router.push(`/song/${song.id}`)
    } catch {
      setError('加载失败，请重试')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">外文歌曲学唱</h1>
        <p className="text-gray-500 mt-2 text-sm">搜索歌曲，查看带中文音译的歌词，单句循环练习</p>
      </div>

      <div className="flex gap-2">
        {LANGUAGES.map(lang => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              language === lang.code
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>

      <SearchBar onSelect={handleSelect} language={language} />

      {loading && (
        <p className="text-sm text-gray-500 animate-pulse">正在获取歌词并生成音译，请稍候（约3-5秒）...</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </main>
  )
}
