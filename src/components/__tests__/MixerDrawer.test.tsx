import { render, screen, fireEvent } from '@testing-library/react'
import MixerDrawer from '../MixerDrawer'

// Mock the hook so we control state without real AudioContext
const mockMixer = {
  isOpen: false,
  isMonitoring: false,
  isRecording: false,
  recordingTime: 0,
  micVolume: 0.75,
  reverbAmount: 0,
  echoAmount: 0,
  analyserNode: null,
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

jest.mock('../../hooks/useAudioMixer', () => ({
  useAudioMixer: () => mockMixer,
}))

// Stub MixerPanel to avoid complex rendering
jest.mock('../MixerPanel', () =>
  ({ onClose }: { onClose: () => void }) => (
    <div data-testid="mixer-panel">
      <button onClick={onClose}>关闭</button>
    </div>
  )
)

beforeEach(() => jest.clearAllMocks())

describe('MixerDrawer', () => {
  it('renders the trigger button', () => {
    render(<MixerDrawer />)
    expect(screen.getByRole('button', { name: /调音台/i })).toBeInTheDocument()
  })

  it('calls openDrawer when trigger button is clicked', () => {
    render(<MixerDrawer />)
    fireEvent.click(screen.getByRole('button', { name: /调音台/i }))
    expect(mockMixer.openDrawer).toHaveBeenCalled()
  })

  it('does not render MixerPanel when closed', () => {
    render(<MixerDrawer />)
    expect(screen.queryByTestId('mixer-panel')).not.toBeInTheDocument()
  })

  it('renders MixerPanel when isOpen is true', () => {
    mockMixer.isOpen = true
    render(<MixerDrawer />)
    expect(screen.getByTestId('mixer-panel')).toBeInTheDocument()
    mockMixer.isOpen = false
  })

  it('calls closeDrawer when MixerPanel close button is clicked', () => {
    mockMixer.isOpen = true
    render(<MixerDrawer />)
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }))
    expect(mockMixer.closeDrawer).toHaveBeenCalled()
    mockMixer.isOpen = false
  })
})
