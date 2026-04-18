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
