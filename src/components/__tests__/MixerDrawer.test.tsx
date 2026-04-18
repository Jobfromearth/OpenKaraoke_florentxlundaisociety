import { render, screen, fireEvent } from '@testing-library/react'
import MixerDrawer from '../MixerDrawer'

const mockMixer = {
  isOpen: false,
  isMonitoring: false,
  isRecording: false,
  recordingTime: 0,
  micVolume: 0.75,
  reverbAmount: 0,
  echoAmount: 0,
  analyserNode: null,
  initMic: jest.fn(),
  hasRecording: false,
  error: null,
  openDrawer: jest.fn(),
  closeDrawer: jest.fn(),
  toggleMonitor: jest.fn(),
  setMicVolume: jest.fn(),
  setReverb: jest.fn(),
  setEcho: jest.fn(),
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  downloadRecording: jest.fn(),
}

// Stub MixerPanel to avoid complex rendering
jest.mock('@/components/MixerPanel', () =>
  ({ onClose }: { onClose: () => void }) => (
    <div data-testid="mixer-panel">
      <button onClick={onClose}>关闭</button>
    </div>
  )
)

beforeEach(() => jest.clearAllMocks())

describe('MixerDrawer', () => {
  it('renders the trigger button', () => {
    render(<MixerDrawer mixer={{ ...mockMixer }} />)
    expect(screen.getByRole('button', { name: /调音台/i })).toBeInTheDocument()
  })

  it('calls openDrawer when trigger button is clicked', () => {
    render(<MixerDrawer mixer={{ ...mockMixer }} />)
    fireEvent.click(screen.getByRole('button', { name: /调音台/i }))
    expect(mockMixer.openDrawer).toHaveBeenCalled()
  })

  it('does not render MixerPanel when closed', () => {
    render(<MixerDrawer mixer={{ ...mockMixer }} />)
    expect(screen.queryByTestId('mixer-panel')).not.toBeInTheDocument()
  })

  it('renders MixerPanel when isOpen is true', () => {
    render(<MixerDrawer mixer={{ ...mockMixer, isOpen: true }} />)
    expect(screen.getByTestId('mixer-panel')).toBeInTheDocument()
  })

  it('calls closeDrawer when MixerPanel close button is clicked', () => {
    render(<MixerDrawer mixer={{ ...mockMixer, isOpen: true }} />)
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }))
    expect(mockMixer.closeDrawer).toHaveBeenCalled()
  })
})
