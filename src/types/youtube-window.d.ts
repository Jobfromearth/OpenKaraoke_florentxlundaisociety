/// <reference types="youtube" />

interface Window {
  YT: typeof YT
  onYouTubeIframeAPIReady: () => void
}
