import { render, screen, fireEvent } from '@testing-library/react'
import MixerPanel from '../MixerPanel'

// Stub PitchVisualizer so Canvas doesn't crash in JSDOM
jest.mock('../PitchVisualizer', () => () => <canvas data-testid="pitch-visualizer" />)

const baseProps = {
  isMonitoring: false,
  isRecording: false,
  recordingTime: 0,
  micVolume: 0.75,
  reverbAmount: 0,
  echoAmount: 0,
  analyserNode: null,
  hasRecording: false,
  error: null,
  onToggleMonitor: jest.fn(),
  onSetMicVolume: jest.fn(),
  onSetReverb: jest.fn(),
  onSetEcho: jest.fn(),
  onStartRecording: jest.fn(),
  onStopRecording: jest.fn(),
  onDownload: jest.fn(),
  onClose: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('MixerPanel', () => {
  it('renders mic volume slider', () => {
    render(<MixerPanel {...baseProps} />)
    expect(screen.getByRole('slider', { name: /麦克风音量/i })).toBeInTheDocument()
  })

  it('renders reverb slider', () => {
    render(<MixerPanel {...baseProps} />)
    expect(screen.getByRole('slider', { name: /混响/i })).toBeInTheDocument()
  })

  it('renders echo slider', () => {
    render(<MixerPanel {...baseProps} />)
    expect(screen.getByRole('slider', { name: /回声/i })).toBeInTheDocument()
  })

  it('calls onSetMicVolume when mic slider changes', () => {
    render(<MixerPanel {...baseProps} />)
    fireEvent.change(screen.getByRole('slider', { name: /麦克风音量/i }), { target: { value: '0.5' } })
    expect(baseProps.onSetMicVolume).toHaveBeenCalledWith(0.5)
  })

  it('calls onToggleMonitor when monitor button is clicked', () => {
    render(<MixerPanel {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /监听/i }))
    expect(baseProps.onToggleMonitor).toHaveBeenCalled()
  })

  it('shows 开始录音 button when not recording', () => {
    render(<MixerPanel {...baseProps} />)
    expect(screen.getByRole('button', { name: /开始录音/i })).toBeInTheDocument()
  })

  it('shows 停止录音 button when recording', () => {
    render(<MixerPanel {...baseProps} isRecording={true} />)
    expect(screen.getByRole('button', { name: /停止录音/i })).toBeInTheDocument()
  })

  it('calls onStartRecording when 开始录音 is clicked', () => {
    render(<MixerPanel {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /开始录音/i }))
    expect(baseProps.onStartRecording).toHaveBeenCalled()
  })

  it('download button is disabled when hasRecording is false', () => {
    render(<MixerPanel {...baseProps} hasRecording={false} />)
    expect(screen.getByRole('button', { name: /下载录音/i })).toBeDisabled()
  })

  it('download button is enabled when hasRecording is true', () => {
    render(<MixerPanel {...baseProps} hasRecording={true} />)
    expect(screen.getByRole('button', { name: /下载录音/i })).not.toBeDisabled()
  })

  it('shows error message when error prop is set', () => {
    render(<MixerPanel {...baseProps} error="需要麦克风权限" />)
    expect(screen.getByText('需要麦克风权限')).toBeInTheDocument()
  })

  it('formats recording time as MM:SS', () => {
    render(<MixerPanel {...baseProps} isRecording={true} recordingTime={75} />)
    expect(screen.getByText('01:15')).toBeInTheDocument()
  })
})
