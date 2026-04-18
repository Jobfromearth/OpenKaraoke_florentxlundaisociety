import { renderHook, act } from '@testing-library/react'
import { useAudioMixer } from '../useAudioMixer'

// ── Web Audio mocks ─────────────────────────────────────────────────────────
const mockConnect = jest.fn()

const makeGainNode = () => ({ connect: mockConnect, gain: { value: 0 } })

const mockAnalyser = {
  connect: mockConnect,
  fftSize: 2048,
  frequencyBinCount: 1024,
  getByteFrequencyData: jest.fn(),
  getFloatTimeDomainData: jest.fn(),
}
const mockConvolver = { connect: mockConnect, buffer: null as AudioBuffer | null }
const mockDelay = { connect: mockConnect, delayTime: { value: 0 } }
const mockRecDest = {
  stream: { getTracks: jest.fn(() => []) },
}

const mockCtx = {
  createMediaStreamSource: jest.fn(() => ({ connect: mockConnect })),
  createGain: jest.fn(makeGainNode),
  createAnalyser: jest.fn(() => mockAnalyser),
  createConvolver: jest.fn(() => mockConvolver),
  createDelay: jest.fn(() => mockDelay),
  createBuffer: jest.fn((_ch: number, length: number, _sr: number) => ({
    getChannelData: jest.fn(() => new Float32Array(length)),
  })),
  createMediaStreamDestination: jest.fn(() => mockRecDest),
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  suspend: jest.fn().mockResolvedValue(undefined),
  destination: {},
  sampleRate: 44100,
  state: 'running' as AudioContextState,
}

global.AudioContext = jest.fn(() => mockCtx) as unknown as typeof AudioContext

const mockMicStream = { getTracks: jest.fn(() => [{ stop: jest.fn() }]) }
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue(mockMicStream),
    getDisplayMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn(() => [{ stop: jest.fn() }]),
      getAudioTracks: jest.fn(() => [{ stop: jest.fn() }]),
    }),
  },
  configurable: true,
  writable: true,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCtx.createGain.mockImplementation(makeGainNode)
  ;(navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockMicStream)
})

// ── Tests ───────────────────────────────────────────────────────────────────
describe('useAudioMixer — initial state', () => {
  it('starts closed with correct defaults', () => {
    const { result } = renderHook(() => useAudioMixer())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.isMonitoring).toBe(false)
    expect(result.current.isRecording).toBe(false)
    expect(result.current.micVolume).toBe(0.75)
    expect(result.current.reverbAmount).toBe(0)
    expect(result.current.echoAmount).toBe(0)
    expect(result.current.analyserNode).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

describe('useAudioMixer — openDrawer', () => {
  it('sets isOpen and requests microphone', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    expect(result.current.isOpen).toBe(true)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false })
  })

  it('exposes analyserNode after pipeline init', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    expect(result.current.analyserNode).toBe(mockAnalyser)
  })

  it('sets error when getUserMedia is denied', async () => {
    ;(navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(
      new DOMException('Permission denied', 'NotAllowedError')
    )
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    expect(result.current.error).toBe('需要麦克风权限')
    expect(result.current.analyserNode).toBeNull()
  })
})

describe('useAudioMixer — closeDrawer', () => {
  it('sets isOpen false and suspends AudioContext', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    act(() => { result.current.closeDrawer() })
    expect(result.current.isOpen).toBe(false)
    expect(mockCtx.suspend).toHaveBeenCalled()
  })
})

describe('useAudioMixer — toggleMonitor', () => {
  it('flips isMonitoring', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    act(() => { result.current.toggleMonitor() })
    expect(result.current.isMonitoring).toBe(true)
    act(() => { result.current.toggleMonitor() })
    expect(result.current.isMonitoring).toBe(false)
  })
})

describe('useAudioMixer — setMicVolume / setReverb / setEcho', () => {
  it('updates micVolume state', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    act(() => { result.current.setMicVolume(0.5) })
    expect(result.current.micVolume).toBe(0.5)
  })

  it('updates reverbAmount state', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    act(() => { result.current.setReverb(0.4) })
    expect(result.current.reverbAmount).toBe(0.4)
  })

  it('updates echoAmount state', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    act(() => { result.current.setEcho(0.3) })
    expect(result.current.echoAmount).toBe(0.3)
  })
})

// ── MediaRecorder mock ───────────────────────────────────────────────────────
const mockRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  ondataavailable: null as ((e: { data: Blob }) => void) | null,
  onstop: null as (() => void) | null,
  state: 'inactive',
}
global.MediaRecorder = jest.fn(() => mockRecorder) as unknown as typeof MediaRecorder
;(MediaRecorder as unknown as jest.Mock).isTypeSupported = jest.fn(() => true)

describe('useAudioMixer — recording', () => {
  it('sets isRecording true after startRecording', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    await act(async () => { result.current.startRecording() })
    expect(result.current.isRecording).toBe(true)
  })

  it('calls getDisplayMedia when recording starts', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    await act(async () => { result.current.startRecording() })
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({ video: false, audio: true })
  })

  it('sets isRecording false after stopRecording', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    await act(async () => { result.current.startRecording() })
    act(() => { result.current.stopRecording() })
    expect(result.current.isRecording).toBe(false)
  })

  it('sets hasRecording true after recorder fires onstop', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    await act(async () => { result.current.startRecording() })
    act(() => {
      result.current.stopRecording()
      mockRecorder.onstop?.()
    })
    expect(result.current.hasRecording).toBe(true)
  })

  it('stays idle and does not throw when getDisplayMedia is denied', async () => {
    ;(navigator.mediaDevices.getDisplayMedia as jest.Mock).mockRejectedValueOnce(
      new DOMException('Cancelled', 'NotAllowedError')
    )
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.openDrawer() })
    await act(async () => { result.current.startRecording() })
    expect(result.current.isRecording).toBe(false)
  })
})
