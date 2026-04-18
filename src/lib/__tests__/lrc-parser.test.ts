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
