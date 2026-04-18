'use client'

import { useState } from 'react'
import type { YouTubeSearchResult } from '@/lib/types'

interface SearchBarProps {
  onSelect: (result: YouTubeSearchResult & { language: string }) => void
  language: string
}

export default function SearchBar({ onSelect, language }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error('搜索失败')
      setResults(await res.json())
    } catch {
      setError('搜索失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative w-full max-w-xl">
      <form role="search" onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="搜索歌曲名 / 歌手..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '搜索中...' : '搜索'}
        </button>
      </form>

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

      {results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow-lg z-10 max-h-80 overflow-y-auto">
          {results.map(result => (
            <li key={result.videoId}>
              <button
                onClick={() => { onSelect({ ...result, language }); setResults([]) }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
              >
                {result.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.thumbnailUrl} alt="" className="w-12 h-9 object-cover rounded" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{result.title}</p>
                  <p className="text-xs text-gray-500 truncate">{result.channelTitle}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
