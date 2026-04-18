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
