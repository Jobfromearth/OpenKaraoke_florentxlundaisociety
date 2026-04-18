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
