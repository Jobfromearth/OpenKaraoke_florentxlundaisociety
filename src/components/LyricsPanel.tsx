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
