'use client'

import { useEffect } from 'react'
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'

interface YouTubePlayerProps {
  videoId: string
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
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <div id="yt-player" className="w-full h-full" />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
          加载中...
        </div>
      )}
    </div>
  )
}
