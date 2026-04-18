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

export type PhoneticLang = 'zh' | 'en' | 'ja' | 'sv'
