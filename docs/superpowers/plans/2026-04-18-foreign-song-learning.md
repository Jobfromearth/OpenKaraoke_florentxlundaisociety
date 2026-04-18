# 外文歌曲学唱 Web App 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Web 应用，让用户可以搜索外文歌曲、查看带中文音译的歌词、并通过单句循环功能练习演唱。

**Architecture:** Next.js 15 App Router 全栈应用，前端负责 YouTube 播放和歌词同步高亮，后端 API Routes 对接 YouTube Data API / lrclib.net / Claude API，数据用 SQLite + Prisma 缓存，避免重复调用 LLM。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Prisma + SQLite, YouTube IFrame API, YouTube Data API v3, lrclib.net, Claude API (claude-sonnet-4-6), Jest + Testing Library

---

## 文件结构

```
D:/startup/
├── .env.local                            # API 密钥（不提交）
├── .env.example                          # 密钥模板
├── jest.config.ts
├── jest.setup.ts
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # 首页：搜索歌曲
│   │   ├── song/[id]/page.tsx            # 播放页：学习界面
│   │   └── api/
│   │       ├── search/route.ts           # GET  搜索 YouTube
│   │       └── songs/
│   │           ├── route.ts              # GET 列表 / POST 创建+生成音译
│   │           └── [id]/route.ts         # GET 单首歌（含歌词）
│   ├── components/
│   │   ├── __tests__/
│   │   │   ├── LyricLine.test.tsx
│   │   │   └── SearchBar.test.tsx
│   │   ├── LyricLine.tsx                 # 单行：原文+音译+颜色分组
│   │   ├── LyricsPanel.tsx               # 歌词滚动容器+高亮同步
│   │   ├── LoopController.tsx            # 单句循环控制条
│   │   ├── PhoneticToggle.tsx            # 显示/隐藏音译开关
│   │   ├── SearchBar.tsx                 # 搜索框+结果下拉
│   │   └── YouTubePlayer.tsx             # IFrame 封装
│   ├── hooks/
│   │   ├── useLyricsSync.ts              # 歌词与播放时间同步
│   │   └── useYouTubePlayer.ts           # YouTube IFrame API 封装
│   └── lib/
│       ├── __tests__/
│       │   └── lrc-parser.test.ts
│       ├── lrc-parser.ts                 # 解析 LRC 格式
│       ├── prisma.ts                     # Prisma 单例
│       └── types.ts                      # 共享 TypeScript 类型
```

---

## Task 1: 项目脚手架

**Files:**
- Create: `D:/startup/` (Next.js 项目)
- Create: `.env.example`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: 初始化 Next.js 项目**

```bash
cd D:/startup
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

当提示时选：TypeScript ✓, Tailwind ✓, App Router ✓, src/ directory ✓

- [ ] **Step 2: 安装依赖**

```bash
npm install @prisma/client @anthropic-ai/sdk
npm install -D prisma jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest
```

- [ ] **Step 3: 创建 jest.config.ts**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 4: 创建 jest.setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: 修改 package.json，添加 test script**

在 `scripts` 中添加：
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: 创建 .env.example**

```bash
# YouTube Data API v3
YOUTUBE_API_KEY=your_youtube_api_key_here

# Anthropic / Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

- [ ] **Step 7: 创建 .env.local（填入真实 key，不提交）**

```bash
cp .env.example .env.local
# 然后手动填入真实的 API key
```

- [ ] **Step 8: 确认 Next.js 能启动**

```bash
npm run dev
```
预期：浏览器打开 http://localhost:3000 显示 Next.js 默认页面

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: 共享类型定义

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: 创建 src/lib/types.ts**

```typescript
export interface Segment {
  original: string   // 外文词/短语，如 "you're"
  phonetic: string   // 中文音译，如 "有儿"
  color: number      // 颜色索引 0-4，用于区分不同分组
}

export interface LyricLine {
  time: number       // 行开始时间（秒）
  endTime: number    // 行结束时间（秒，等于下一行 time）
  text: string       // 原文歌词
  phonetic: string   // 完整中文音译
  segments: Segment[] // 词级映射分组
}

export interface Song {
  id: string
  youtubeId: string
  title: string
  artist: string
  language: string   // 'en' | 'ja' | 'ko' | 'es' | 'sv'
  thumbnailUrl: string
  durationSeconds: number
  createdAt: string
}

export interface SongWithLyrics extends Song {
  lines: LyricLine[]
}

export interface YouTubeSearchResult {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  durationSeconds: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: LRC 解析器（TDD）

**Files:**
- Create: `src/lib/lrc-parser.ts`
- Create: `src/lib/__tests__/lrc-parser.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/lib/__tests__/lrc-parser.test.ts`：

```typescript
import { parseLRC } from '../lrc-parser'

describe('parseLRC', () => {
  it('parses two standard LRC lines with correct timestamps and endTimes', () => {
    const lrc = `[00:12.00]Hello world\n[00:15.50]How are you`
    const result = parseLRC(lrc)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ time: 12, endTime: 15.5, text: 'Hello world' })
    expect(result[1]).toEqual({ time: 15.5, endTime: 20.5, text: 'How are you' })
  })

  it('last line endTime defaults to time + 5', () => {
    const lrc = `[00:12.00]Only line`
    const result = parseLRC(lrc)
    expect(result[0].endTime).toBe(17)
  })

  it('skips metadata tags and empty text lines', () => {
    const lrc = `[ti:Test Song]\n[ar:Artist]\n[00:00.00]\n[00:12.00]Hello`
    const result = parseLRC(lrc)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Hello')
  })

  it('handles 3-digit milliseconds', () => {
    const lrc = `[00:12.500]Hello`
    const result = parseLRC(lrc)
    expect(result[0].time).toBe(12.5)
  })

  it('sorts lines by time even if out of order in input', () => {
    const lrc = `[00:15.00]Second\n[00:10.00]First`
    const result = parseLRC(lrc)
    expect(result[0].text).toBe('First')
    expect(result[1].text).toBe('Second')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx jest src/lib/__tests__/lrc-parser.test.ts
```
预期：FAIL — "Cannot find module '../lrc-parser'"

- [ ] **Step 3: 实现 lrc-parser.ts**

创建 `src/lib/lrc-parser.ts`：

```typescript
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
    const text = match[4].trim()
    if (text) raw.push({ time, text })
  }

  raw.sort((a, b) => a.time - b.time)

  return raw.map((line, i) => ({
    time: line.time,
    endTime: raw[i + 1]?.time ?? line.time + 5,
    text: line.text,
  }))
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx jest src/lib/__tests__/lrc-parser.test.ts
```
预期：PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/lrc-parser.ts src/lib/__tests__/lrc-parser.test.ts
git commit -m "feat: add LRC parser with tests"
```

---

## Task 4: Prisma Schema & 数据库

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: 初始化 Prisma**

```bash
npx prisma init --datasource-provider sqlite
```
预期：生成 `prisma/schema.prisma` 和 `.env`（不使用，我们用 `.env.local`）

- [ ] **Step 2: 编写 prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Song {
  id              String   @id @default(cuid())
  youtubeId       String   @unique
  title           String
  artist          String
  language        String
  thumbnailUrl    String
  durationSeconds Int
  createdAt       DateTime @default(now())
  lyrics          Lyrics?
}

model Lyrics {
  id     String @id @default(cuid())
  songId String @unique
  song   Song   @relation(fields: [songId], references: [id])
  lines  String // JSON array of LyricLine[]
}
```

- [ ] **Step 3: 生成 Prisma Client 并创建数据库**

```bash
npx prisma migrate dev --name init
```
预期：生成 `prisma/dev.db` 和 `prisma/migrations/`

- [ ] **Step 4: 创建 src/lib/prisma.ts（单例）**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/lib/prisma.ts
git commit -m "feat: add Prisma schema and SQLite database"
```

---

## Task 5: API Route — GET /api/search

**Files:**
- Create: `src/app/api/search/route.ts`

- [ ] **Step 1: 创建 src/app/api/search/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import type { YouTubeSearchResult } from '@/lib/types'

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] ?? '0', 10)
  const minutes = parseInt(match[2] ?? '0', 10)
  const seconds = parseInt(match[3] ?? '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Missing YOUTUBE_API_KEY' }, { status: 500 })

  // Step 1: Search for videos
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('q', q)
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('videoCategoryId', '10') // Music category
  searchUrl.searchParams.set('maxResults', '8')
  searchUrl.searchParams.set('key', apiKey)

  const searchRes = await fetch(searchUrl.toString())
  if (!searchRes.ok) {
    return NextResponse.json({ error: 'YouTube search failed' }, { status: 502 })
  }
  const searchData = await searchRes.json()
  const items = searchData.items ?? []
  const videoIds: string[] = items.map((item: { id: { videoId: string } }) => item.id.videoId)

  if (videoIds.length === 0) return NextResponse.json([])

  // Step 2: Get video durations
  const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  detailsUrl.searchParams.set('part', 'contentDetails')
  detailsUrl.searchParams.set('id', videoIds.join(','))
  detailsUrl.searchParams.set('key', apiKey)

  const detailsRes = await fetch(detailsUrl.toString())
  const detailsData = await detailsRes.json()
  const durationMap: Record<string, number> = {}
  for (const item of detailsData.items ?? []) {
    durationMap[item.id] = parseISO8601Duration(item.contentDetails.duration)
  }

  const results: YouTubeSearchResult[] = items.map((item: {
    id: { videoId: string }
    snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } }
  }) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails.medium.url,
    durationSeconds: durationMap[item.id.videoId] ?? 0,
  }))

  return NextResponse.json(results)
}
```

- [ ] **Step 2: 手动测试**

启动开发服务器后访问：
```
http://localhost:3000/api/search?q=Hello+Adele
```
预期：返回包含 YouTube 视频信息的 JSON 数组

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "feat: add YouTube search API route"
```

---

## Task 6: API Route — POST /api/songs（核心：歌词+音译生成）

**Files:**
- Create: `src/app/api/songs/route.ts`

- [ ] **Step 1: 创建 src/app/api/songs/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { parseLRC } from '@/lib/lrc-parser'
import type { LyricLine, Segment } from '@/lib/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function fetchLRC(title: string, artist: string, durationSeconds: number): Promise<string | null> {
  const url = new URL('https://lrclib.net/api/get')
  url.searchParams.set('track_name', title)
  url.searchParams.set('artist_name', artist)
  url.searchParams.set('duration', String(durationSeconds))
  const res = await fetch(url.toString(), { headers: { 'Lrclib-Client': 'foreign-song-learner v0.1' } })
  if (!res.ok) return null
  const data = await res.json()
  return data.syncedLyrics ?? null
}

async function generatePhonetics(
  language: string,
  lines: { index: number; text: string }[]
): Promise<{ index: number; phonetic: string; segments: { original: string; phonetic: string }[] }[]> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `你是一个专业的外语歌曲音译助手。将歌词转写为中国人能"按汉字发音来模拟演唱"的中文音译。
要求：①贴近原语言发音 ②自然流畅可唱 ③按词/短语分组返回 segments。
只返回合法 JSON 数组，不含其他任何文字或代码块标记。`,
    messages: [{
      role: 'user',
      content: JSON.stringify({ language, lines }),
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  return JSON.parse(text)
}

// GET /api/songs — list saved songs
export async function GET() {
  const songs = await prisma.song.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, youtubeId: true, title: true, artist: true, language: true, thumbnailUrl: true, durationSeconds: true, createdAt: true },
  })
  return NextResponse.json(songs)
}

// POST /api/songs — create or retrieve song with lyrics+phonetics
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    youtubeId: string
    title: string
    artist: string
    language: string
    thumbnailUrl: string
    durationSeconds: number
  }

  const { youtubeId, title, artist, language, thumbnailUrl, durationSeconds } = body

  // Return cached result if exists
  const existing = await prisma.song.findUnique({
    where: { youtubeId },
    include: { lyrics: true },
  })
  if (existing?.lyrics) {
    return NextResponse.json({
      ...existing,
      lines: JSON.parse(existing.lyrics.lines) as LyricLine[],
    })
  }

  // Create song record
  const song = await prisma.song.upsert({
    where: { youtubeId },
    update: {},
    create: { youtubeId, title, artist, language, thumbnailUrl, durationSeconds },
  })

  // Fetch LRC lyrics
  const lrcText = await fetchLRC(title, artist, durationSeconds)
  if (!lrcText) {
    return NextResponse.json({ error: 'lyrics_not_found', song }, { status: 404 })
  }

  const rawLines = parseLRC(lrcText)

  // Generate phonetics with Claude
  let phoneticData: { index: number; phonetic: string; segments: { original: string; phonetic: string }[] }[]
  try {
    phoneticData = await generatePhonetics(
      language,
      rawLines.map((line, i) => ({ index: i, text: line.text }))
    )
  } catch {
    // Save lines without phonetics on failure, mark for retry
    const fallbackLines: LyricLine[] = rawLines.map(line => ({
      ...line,
      phonetic: '',
      segments: [],
    }))
    await prisma.lyrics.create({ data: { songId: song.id, lines: JSON.stringify(fallbackLines) } })
    return NextResponse.json({ error: 'phonetics_failed', song, lines: fallbackLines }, { status: 206 })
  }

  // Merge phonetics into lines
  const COLORS = [0, 1, 2, 3, 4]
  const lines: LyricLine[] = rawLines.map((line, i) => {
    const pd = phoneticData.find(p => p.index === i)
    if (!pd) return { ...line, phonetic: '', segments: [] }
    const segments: Segment[] = pd.segments.map((seg, j) => ({
      original: seg.original,
      phonetic: seg.phonetic,
      color: COLORS[j % COLORS.length],
    }))
    return { ...line, phonetic: pd.phonetic, segments }
  })

  await prisma.lyrics.create({ data: { songId: song.id, lines: JSON.stringify(lines) } })

  return NextResponse.json({ ...song, lines })
}
```

- [ ] **Step 2: 手动测试**

```bash
curl -X POST http://localhost:3000/api/songs \
  -H "Content-Type: application/json" \
  -d '{"youtubeId":"dQw4w9WgXcQ","title":"Never Gonna Give You Up","artist":"Rick Astley","language":"en","thumbnailUrl":"https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg","durationSeconds":212}'
```
预期：返回包含 `lines` 数组的 JSON，每行有 `phonetic` 和 `segments`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/songs/route.ts
git commit -m "feat: add songs API route with lyrics fetch and Claude phonetics generation"
```

---

## Task 7: API Route — GET /api/songs/[id]

**Files:**
- Create: `src/app/api/songs/[id]/route.ts`

- [ ] **Step 1: 创建 src/app/api/songs/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { LyricLine } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const song = await prisma.song.findUnique({
    where: { id },
    include: { lyrics: true },
  })
  if (!song) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const lines: LyricLine[] = song.lyrics ? JSON.parse(song.lyrics.lines) : []
  return NextResponse.json({ ...song, lines })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/songs/[id]/route.ts
git commit -m "feat: add GET /api/songs/[id] route"
```

---

## Task 8: useYouTubePlayer Hook

**Files:**
- Create: `src/hooks/useYouTubePlayer.ts`

- [ ] **Step 1: 创建 src/hooks/useYouTubePlayer.ts**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

interface UseYouTubePlayerOptions {
  videoId: string
  containerId: string
}

export function useYouTubePlayer({ videoId, containerId }: UseYouTubePlayerOptions) {
  const playerRef = useRef<YT.Player | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!videoId) return

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setIsReady(true),
          onStateChange: (event: YT.OnStateChangeEvent) => {
            setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
          },
        },
      })
    }

    if (typeof window !== 'undefined' && window.YT?.Player) {
      initPlayer()
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
      window.onYouTubeIframeAPIReady = initPlayer
    }

    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
      setIsReady(false)
    }
  }, [videoId, containerId])

  const seekTo = useCallback((time: number) => {
    playerRef.current?.seekTo(time, true)
    playerRef.current?.playVideo()
  }, [])

  const getCurrentTime = useCallback((): number => {
    return playerRef.current?.getCurrentTime() ?? 0
  }, [])

  return { isReady, isPlaying, seekTo, getCurrentTime }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useYouTubePlayer.ts
git commit -m "feat: add useYouTubePlayer hook"
```

---

## Task 9: YouTubePlayer 组件

**Files:**
- Create: `src/components/YouTubePlayer.tsx`

- [ ] **Step 1: 创建 src/components/YouTubePlayer.tsx**

```typescript
'use client'

import { useEffect } from 'react'
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'

interface YouTubePlayerProps {
  videoId: string
  onReady?: () => void
  onSeekTo?: (fn: (time: number) => void) => void
  onGetCurrentTime?: (fn: () => number) => void
  onPlayingChange?: (isPlaying: boolean) => void
}

export default function YouTubePlayer({
  videoId,
  onSeekTo,
  onGetCurrentTime,
  onPlayingChange,
}: YouTubePlayerProps) {
  const { isReady, isPlaying, seekTo, getCurrentTime } = useYouTubePlayer({
    videoId,
    containerId: 'yt-player',
  })

  // Expose methods to parent when player becomes ready
  useEffect(() => {
    if (!isReady) return
    onSeekTo?.(seekTo)
    onGetCurrentTime?.(getCurrentTime)
  }, [isReady, seekTo, getCurrentTime, onSeekTo, onGetCurrentTime])

  useEffect(() => {
    onPlayingChange?.(isPlaying)
  }, [isPlaying, onPlayingChange])

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
      <div id="yt-player" className="w-full h-full" />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
          加载中...
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/YouTubePlayer.tsx
git commit -m "feat: add YouTubePlayer component"
```

---

## Task 10: LyricLine 组件（TDD）

**Files:**
- Create: `src/components/LyricLine.tsx`
- Create: `src/components/__tests__/LyricLine.test.tsx`

颜色常量（color 0-4 → Tailwind 类）：
```
0 → text-blue-600 / bg-blue-50
1 → text-rose-600 / bg-rose-50
2 → text-emerald-600 / bg-emerald-50
3 → text-purple-600 / bg-purple-50
4 → text-orange-600 / bg-orange-50
```

- [ ] **Step 1: 写失败测试**

创建 `src/components/__tests__/LyricLine.test.tsx`：

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import LyricLine from '../LyricLine'
import type { LyricLine as LyricLineType } from '@/lib/types'

const mockLine: LyricLineType = {
  time: 12.5,
  endTime: 15.2,
  text: "you're looking for",
  phonetic: '有儿 路奇恩佛',
  segments: [
    { original: "you're", phonetic: '有儿', color: 0 },
    { original: 'looking for', phonetic: '路奇恩佛', color: 1 },
  ],
}

describe('LyricLine', () => {
  it('renders each segment original text', () => {
    render(
      <LyricLine line={mockLine} isActive={false} showPhonetic={true} progress={0} onClick={jest.fn()} />
    )
    expect(screen.getByText("you're")).toBeInTheDocument()
    expect(screen.getByText('looking for')).toBeInTheDocument()
  })

  it('renders phonetic text when showPhonetic is true', () => {
    render(
      <LyricLine line={mockLine} isActive={false} showPhonetic={true} progress={0} onClick={jest.fn()} />
    )
    expect(screen.getByText('有儿')).toBeInTheDocument()
    expect(screen.getByText('路奇恩佛')).toBeInTheDocument()
  })

  it('hides phonetic text when showPhonetic is false', () => {
    render(
      <LyricLine line={mockLine} isActive={false} showPhonetic={false} progress={0} onClick={jest.fn()} />
    )
    expect(screen.queryByText('有儿')).not.toBeInTheDocument()
  })

  it('calls onClick when the line is clicked', () => {
    const onClick = jest.fn()
    render(
      <LyricLine line={mockLine} isActive={false} showPhonetic={true} progress={0} onClick={onClick} />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies active highlight class when isActive is true', () => {
    render(
      <LyricLine line={mockLine} isActive={true} showPhonetic={true} progress={0} onClick={jest.fn()} />
    )
    expect(screen.getByRole('button').className).toMatch(/bg-yellow/)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx jest src/components/__tests__/LyricLine.test.tsx
```
预期：FAIL — "Cannot find module '../LyricLine'"

- [ ] **Step 3: 实现 LyricLine.tsx**

创建 `src/components/LyricLine.tsx`：

```typescript
'use client'

import type { LyricLine as LyricLineType } from '@/lib/types'

const COLOR_CLASSES: Record<number, { text: string; dim: string }> = {
  0: { text: 'text-blue-600', dim: 'text-blue-200' },
  1: { text: 'text-rose-600', dim: 'text-rose-200' },
  2: { text: 'text-emerald-600', dim: 'text-emerald-200' },
  3: { text: 'text-purple-600', dim: 'text-purple-200' },
  4: { text: 'text-orange-600', dim: 'text-orange-200' },
}

interface LyricLineProps {
  line: LyricLineType
  isActive: boolean
  showPhonetic: boolean
  progress: number   // 0–1, used in loop mode for left-to-right scan
  onClick: () => void
}

export default function LyricLine({ line, isActive, showPhonetic, progress, onClick }: LyricLineProps) {
  const activeSegmentIndex = isActive && progress > 0
    ? Math.floor(progress * line.segments.length)
    : line.segments.length // all lit when not in scan mode

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-colors cursor-pointer ${
        isActive ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'hover:bg-gray-50'
      }`}
    >
      {/* Original text row */}
      <div className="flex flex-wrap gap-x-2 text-base font-medium">
        {line.segments.length > 0 ? (
          line.segments.map((seg, i) => {
            const colors = COLOR_CLASSES[seg.color % 5]
            const isLit = i <= activeSegmentIndex
            return (
              <span key={i} className={isLit ? colors.text : colors.dim}>
                {seg.original}
              </span>
            )
          })
        ) : (
          <span className={isActive ? 'text-gray-900' : 'text-gray-600'}>{line.text}</span>
        )}
      </div>

      {/* Phonetic row */}
      {showPhonetic && (
        <div className="flex flex-wrap gap-x-2 text-sm mt-0.5">
          {line.segments.length > 0 ? (
            line.segments.map((seg, i) => {
              const colors = COLOR_CLASSES[seg.color % 5]
              const isLit = i <= activeSegmentIndex
              return (
                <span key={i} className={isLit ? colors.text : colors.dim}>
                  {seg.phonetic}
                </span>
              )
            })
          ) : (
            <span className="text-gray-400">{line.phonetic || '—'}</span>
          )}
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx jest src/components/__tests__/LyricLine.test.tsx
```
预期：PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/LyricLine.tsx src/components/__tests__/LyricLine.test.tsx
git commit -m "feat: add LyricLine component with color-grouped segments and TDD tests"
```

---

## Task 11: SearchBar 组件（TDD）

**Files:**
- Create: `src/components/SearchBar.tsx`
- Create: `src/components/__tests__/SearchBar.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/components/__tests__/SearchBar.test.tsx`：

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from '../SearchBar'
import type { YouTubeSearchResult } from '@/lib/types'

const mockResults: YouTubeSearchResult[] = [
  { videoId: 'abc123', title: 'Hello - Adele', channelTitle: 'Adele', thumbnailUrl: '', durationSeconds: 295 },
]

describe('SearchBar', () => {
  it('renders search input', () => {
    render(<SearchBar onSelect={jest.fn()} language="en" />)
    expect(screen.getByPlaceholderText(/搜索歌曲/)).toBeInTheDocument()
  })

  it('shows results after search', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    }) as jest.Mock

    render(<SearchBar onSelect={jest.fn()} language="en" />)
    await userEvent.type(screen.getByPlaceholderText(/搜索歌曲/), 'Hello')
    fireEvent.submit(screen.getByRole('search'))

    await waitFor(() => {
      expect(screen.getByText('Hello - Adele')).toBeInTheDocument()
    })
  })

  it('calls onSelect with result when clicked', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    }) as jest.Mock

    const onSelect = jest.fn()
    render(<SearchBar onSelect={onSelect} language="en" />)
    await userEvent.type(screen.getByPlaceholderText(/搜索歌曲/), 'Hello')
    fireEvent.submit(screen.getByRole('search'))

    await waitFor(() => screen.getByText('Hello - Adele'))
    fireEvent.click(screen.getByText('Hello - Adele'))
    expect(onSelect).toHaveBeenCalledWith(mockResults[0])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx jest src/components/__tests__/SearchBar.test.tsx
```
预期：FAIL — "Cannot find module '../SearchBar'"

- [ ] **Step 3: 实现 SearchBar.tsx**

创建 `src/components/SearchBar.tsx`：

```typescript
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx jest src/components/__tests__/SearchBar.test.tsx
```
预期：PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.tsx src/components/__tests__/SearchBar.test.tsx
git commit -m "feat: add SearchBar component with TDD tests"
```

---

## Task 12: useLyricsSync Hook

**Files:**
- Create: `src/hooks/useLyricsSync.ts`

- [ ] **Step 1: 创建 src/hooks/useLyricsSync.ts**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useLyricsSync.ts
git commit -m "feat: add useLyricsSync hook for lyric highlighting and loop control"
```

---

## Task 13: LyricsPanel 组件

**Files:**
- Create: `src/components/LyricsPanel.tsx`

- [ ] **Step 1: 创建 src/components/LyricsPanel.tsx**

```typescript
'use client'

import { useEffect, useRef } from 'react'
import type { LyricLine } from '@/lib/types'
import LyricLineComponent from './LyricLine'

interface LyricsPanelProps {
  lines: LyricLine[]
  activeIndex: number
  progress: number
  loopLine: LyricLine | null
  showPhonetic: boolean
  onLineClick: (line: LyricLine) => void
}

export default function LyricsPanel({
  lines,
  activeIndex,
  progress,
  loopLine,
  showPhonetic,
  onLineClick,
}: LyricsPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeIndex])

  return (
    <div className="flex flex-col gap-1 overflow-y-auto h-full px-2">
      {lines.map((line, i) => (
        <div key={i} ref={i === activeIndex ? activeRef : null}>
          <LyricLineComponent
            line={line}
            isActive={i === activeIndex}
            showPhonetic={showPhonetic}
            progress={i === activeIndex && loopLine !== null ? progress : 0}
            onClick={() => onLineClick(line)}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LyricsPanel.tsx
git commit -m "feat: add LyricsPanel with auto-scroll to active line"
```

---

## Task 14: LoopController 组件

**Files:**
- Create: `src/components/LoopController.tsx`

- [ ] **Step 1: 创建 src/components/LoopController.tsx**

```typescript
'use client'

import type { LyricLine } from '@/lib/types'

interface LoopControllerProps {
  loopLine: LyricLine | null
  onExit: () => void
}

export default function LoopController({ loopLine, onExit }: LoopControllerProps) {
  if (!loopLine) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full flex items-center gap-3 shadow-lg z-20">
      <span>🔁 单句循环：</span>
      <span className="max-w-48 truncate opacity-80">{loopLine.text}</span>
      <button
        onClick={onExit}
        className="ml-2 text-gray-400 hover:text-white transition-colors"
        aria-label="退出循环"
      >
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LoopController.tsx
git commit -m "feat: add LoopController component"
```

---

## Task 15: PhoneticToggle 组件

**Files:**
- Create: `src/components/PhoneticToggle.tsx`

- [ ] **Step 1: 创建 src/components/PhoneticToggle.tsx**

```typescript
'use client'

interface PhoneticToggleProps {
  showPhonetic: boolean
  onToggle: () => void
}

export default function PhoneticToggle({ showPhonetic, onToggle }: PhoneticToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        showPhonetic
          ? 'bg-blue-50 border-blue-300 text-blue-700'
          : 'bg-gray-50 border-gray-300 text-gray-500'
      }`}
    >
      {showPhonetic ? '隐藏音译' : '显示音译'}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PhoneticToggle.tsx
git commit -m "feat: add PhoneticToggle component"
```

---

## Task 16: 首页（搜索页）

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 修改 src/app/page.tsx**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add home page with song search and language selector"
```

---

## Task 17: 播放页（核心学习界面）

**Files:**
- Create: `src/app/song/[id]/page.tsx`

- [ ] **Step 1: 创建 src/app/song/[id]/page.tsx**

```typescript
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
```

- [ ] **Step 2: 手动端到端验证**

1. 运行 `npm run dev`
2. 访问 http://localhost:3000
3. 选择语言"英语"，搜索 "Hello Adele"
4. 点击搜索结果 → 等待音译生成（3-5秒）
5. 进入播放页，点击播放
6. 确认：歌词随播放高亮滚动，音译显示在每行下方，颜色分组正确
7. 点击某行 → 确认底部出现循环提示条、视频跳到该行并循环
8. 点击"✕"退出循环
9. 点击"隐藏音译"→ 确认音译消失

- [ ] **Step 3: Commit**

```bash
git add src/app/song/[id]/page.tsx
git commit -m "feat: add player page with lyrics sync, loop mode, and phonetic toggle"
```

---

## Task 18: 全量测试 & 收尾

- [ ] **Step 1: 运行所有测试**

```bash
npx jest
```
预期：所有测试通过（lrc-parser × 5, LyricLine × 5, SearchBar × 3）

- [ ] **Step 2: 确认 prisma/dev.db 已加入 .gitignore**

在 `.gitignore` 中确认含有：
```
prisma/*.db
prisma/*.db-journal
.env.local
```

- [ ] **Step 3: 最终提交**

```bash
git add .gitignore
git commit -m "chore: ensure db and env files are gitignored"
```

---

## 附：环境变量获取方式

| 变量 | 获取方式 |
|------|----------|
| `YOUTUBE_API_KEY` | Google Cloud Console → 启用 YouTube Data API v3 → 创建 API 密钥 |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
