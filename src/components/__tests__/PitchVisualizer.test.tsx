import { render } from '@testing-library/react'
import PitchVisualizer from '../PitchVisualizer'

// ResizeObserver mock — not available in jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}))

// Canvas mock — JSDOM doesn't implement canvas rendering
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext

describe('PitchVisualizer', () => {
  it('renders a canvas element', () => {
    const { container } = render(<PitchVisualizer analyserNode={null} />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('does not crash when analyserNode is null', () => {
    expect(() => render(<PitchVisualizer analyserNode={null} />)).not.toThrow()
  })
})
