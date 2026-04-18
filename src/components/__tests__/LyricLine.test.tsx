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

  it('dims later segments during progress scan when isActive and progress > 0', () => {
    // With 2 segments and progress=0.1: activeSegmentIndex = Math.floor(0.1 * 2) = 0
    // segment 0 (i=0): i <= 0 → lit  → text-blue-600
    // segment 1 (i=1): i >  0 → dim  → text-rose-200 (NOT text-rose-600)
    const { container } = render(
      <LyricLine line={mockLine} isActive={true} showPhonetic={false} progress={0.1} onClick={jest.fn()} />
    )
    const spans = container.querySelectorAll('div.flex span')
    // Second segment should carry the dim class, not the full color class
    expect(spans[1].className).toContain('text-rose-200')
    expect(spans[1].className).not.toContain('text-rose-600')
    // First segment should still be fully lit
    expect(spans[0].className).toContain('text-blue-600')
    expect(spans[0].className).not.toContain('text-blue-200')
  })

  it('renders line.text directly when segments array is empty', () => {
    const emptySegmentsLine: LyricLineType = {
      time: 5,
      endTime: 8,
      text: 'fallback plain text',
      phonetic: 'fallback phonetic',
      segments: [],
    }
    render(
      <LyricLine line={emptySegmentsLine} isActive={false} showPhonetic={true} progress={0} onClick={jest.fn()} />
    )
    expect(screen.getByText('fallback plain text')).toBeInTheDocument()
    expect(screen.getByText('fallback phonetic')).toBeInTheDocument()
  })
})
