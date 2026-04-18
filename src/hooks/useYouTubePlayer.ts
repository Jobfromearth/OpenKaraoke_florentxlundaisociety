import { useEffect, useRef, useState, useCallback } from 'react'

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

    let active = true

    if (typeof window !== 'undefined' && window.YT?.Player) {
      initPlayer()
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        if (active) initPlayer()
      }
    }

    return () => {
      active = false
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
