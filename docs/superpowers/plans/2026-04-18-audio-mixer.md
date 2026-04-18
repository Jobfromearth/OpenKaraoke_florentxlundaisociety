# Audio Mixer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom-drawer audio mixer to the song page with mic monitoring, KTV effects, real-time pitch/volume visualisation, and tab-audio recording.

**Architecture:** A `useAudioMixer` hook owns the entire Web Audio pipeline (AudioContext, gain nodes, convolver, delay, MediaRecorder) and exposes state + actions. Four components consume it: `MixerDrawer` (drawer shell), `MixerPanel` (three-column UI), and `PitchVisualizer` (Canvas RAF loop). The song page adds `<MixerDrawer />` at the bottom — no existing components are touched.

**Tech Stack:** Web Audio API (AudioContext, GainNode, AnalyserNode, ConvolverNode, DelayNode, MediaStreamAudioDestinationNode), MediaRecorder API, getDisplayMedia API, React 19, Tailwind CSS v4, TypeScript, Jest + Testing Library.

---

## File Map

| Action | File |
|--------|------|
| Create | `src/hooks/useAudioMixer.ts` |
| Create | `src/hooks/__tests__/useAudioMixer.test.ts` |
| Create | `src/components/PitchVisualizer.tsx` |
| Create | `src/components/__tests__/PitchVisualizer.test.tsx` |
| Create | `src/components/MixerPanel.tsx` |
| Create | `src/components/__tests__/MixerPanel.test.tsx` |
| Create | `src/components/MixerDrawer.tsx` |
| Create | `src/components/__tests__/MixerDrawer.test.tsx` |
| Modify | `src/app/song/[id]/page.tsx` |

---

## Task 1: `useAudioMixer` hook — mic pipeline + effects + monitor

**Files:**
- Create: `src/hooks/useAudioMixer.ts`
- Create: `src/hooks/__tests__/useAudioMixer.test.ts`

---

- [ ] **Step 1: Write failing tests**

Create `src/hooks/__tests__/useAudioMixer.test.ts`:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/hooks/__tests__/useAudioMixer.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../useAudioMixer'`

- [ ] **Step 3: Implement `useAudioMixer` (pipeline + effects + monitor only — no recording yet)**

Create `src/hooks/useAudioMixer.ts`:

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface AudioNodes {
  ctx: AudioContext
  micStream: MediaStream
  micGain: GainNode
  analyser: AnalyserNode
  dryGain: GainNode
  convolver: ConvolverNode
  reverbGain: GainNode
  delay: DelayNode
  echoGain: GainNode
  sumGain: GainNode
  monitorGain: GainNode
  recDest: MediaStreamAudioDestinationNode
}

function createImpulseResponse(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const ch = impulse.getChannelData(c)
    for (let i = 0; i < length; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2)
    }
  }
  return impulse
}

async function buildPipeline(micStream: MediaStream): Promise<AudioNodes> {
  const ctx = new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()

  const micSource = ctx.createMediaStreamSource(micStream)
  const micGain = ctx.createGain()
  micGain.gain.value = 0.75

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048

  const dryGain = ctx.createGain()
  dryGain.gain.value = 1

  const convolver = ctx.createConvolver()
  convolver.buffer = createImpulseResponse(ctx)
  const reverbGain = ctx.createGain()
  reverbGain.gain.value = 0

  const delay = ctx.createDelay(1.0)
  delay.delayTime.value = 0.3
  const echoGain = ctx.createGain()
  echoGain.gain.value = 0

  const sumGain = ctx.createGain()
  sumGain.gain.value = 1

  const monitorGain = ctx.createGain()
  monitorGain.gain.value = 0   // off by default — prevents feedback without headphones

  const recDest = ctx.createMediaStreamDestination()

  micSource.connect(micGain)
  micGain.connect(analyser)
  analyser.connect(dryGain)
  analyser.connect(convolver)
  convolver.connect(reverbGain)
  analyser.connect(delay)
  delay.connect(echoGain)
  dryGain.connect(sumGain)
  reverbGain.connect(sumGain)
  echoGain.connect(sumGain)
  sumGain.connect(monitorGain)
  monitorGain.connect(ctx.destination)
  sumGain.connect(recDest)

  return { ctx, micStream, micGain, analyser, dryGain, convolver, reverbGain, delay, echoGain, sumGain, monitorGain, recDest }
}

export function useAudioMixer() {
  const nodesRef = useRef<AudioNodes | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingBlobRef = useRef<Blob | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [micVolume, setMicVolumeState] = useState(0.75)
  const [reverbAmount, setReverbAmountState] = useState(0)
  const [echoAmount, setEchoAmountState] = useState(0)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasRecording, setHasRecording] = useState(false)

  const openDrawer = useCallback(async () => {
    setIsOpen(true)
    if (nodesRef.current) {
      await nodesRef.current.ctx.resume()
      return
    }
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const nodes = await buildPipeline(micStream)
      nodesRef.current = nodes
      setAnalyserNode(nodes.analyser)
      setError(null)
    } catch {
      setError('需要麦克风权限')
    }
  }, [])

  const closeDrawer = useCallback(() => {
    setIsOpen(false)
    nodesRef.current?.ctx.suspend()
  }, [])

  const toggleMonitor = useCallback(() => {
    setIsMonitoring(prev => {
      const next = !prev
      if (nodesRef.current) nodesRef.current.monitorGain.gain.value = next ? 1 : 0
      return next
    })
  }, [])

  const setMicVolume = useCallback((v: number) => {
    setMicVolumeState(v)
    if (nodesRef.current) nodesRef.current.micGain.gain.value = v
  }, [])

  const setReverb = useCallback((v: number) => {
    setReverbAmountState(v)
    if (nodesRef.current) nodesRef.current.reverbGain.gain.value = v
  }, [])

  const setEcho = useCallback((v: number) => {
    setEchoAmountState(v)
    if (nodesRef.current) nodesRef.current.echoGain.gain.value = v
  }, [])

  const startRecording = useCallback(async () => { /* Task 2 */ }, [])
  const stopRecording = useCallback(() => { /* Task 2 */ }, [])
  const downloadRecording = useCallback(() => { /* Task 2 */ }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      nodesRef.current?.micStream.getTracks().forEach(t => t.stop())
      nodesRef.current?.ctx.close()
    }
  }, [])

  return {
    isOpen, isMonitoring, isRecording, recordingTime,
    micVolume, reverbAmount, echoAmount,
    analyserNode, error, hasRecording,
    openDrawer, closeDrawer, toggleMonitor,
    setMicVolume, setReverb, setEcho,
    startRecording, stopRecording, downloadRecording,
  }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx jest src/hooks/__tests__/useAudioMixer.test.ts --no-coverage
```

Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAudioMixer.ts src/hooks/__tests__/useAudioMixer.test.ts
git commit -m "feat: add useAudioMixer hook with mic pipeline, effects, and monitor"
```

---

## Task 2: `useAudioMixer` — recording (getDisplayMedia + MediaRecorder)

**Files:**
- Modify: `src/hooks/useAudioMixer.ts`
- Modify: `src/hooks/__tests__/useAudioMixer.test.ts`

---

- [ ] **Step 1: Add recording tests**

Append to `src/hooks/__tests__/useAudioMixer.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run new tests to confirm they fail**

```bash
npx jest src/hooks/__tests__/useAudioMixer.test.ts --no-coverage -t "recording"
```

Expected: FAIL — `startRecording` stub does nothing

- [ ] **Step 3: Replace the three recording stubs in `src/hooks/useAudioMixer.ts`**

Replace the three placeholder callbacks:

```typescript
  const startRecording = useCallback(async () => {
    if (!nodesRef.current) return
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true })
      displayStreamRef.current = displayStream

      const { ctx, recDest } = nodesRef.current
      const displaySource = ctx.createMediaStreamSource(displayStream)
      const displayGain = ctx.createGain()
      displayGain.gain.value = 1
      displaySource.connect(displayGain)
      displayGain.connect(recDest)

      const hasAudio = displayStream.getAudioTracks().length > 0
      chunksRef.current = []
      recordingBlobRef.current = null
      setHasRecording(false)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(recDest.stream, { mimeType })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        recordingBlobRef.current = blob
        setHasRecording(true)
        if (!hasAudio) setError('录音未包含音乐（未选择共享标签页音频）')
      }

      recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      // user cancelled getDisplayMedia — do nothing
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    recorderRef.current?.stop()
    displayStreamRef.current?.getTracks().forEach(t => t.stop())
    displayStreamRef.current = null
    recorderRef.current = null
    setIsRecording(false)
  }, [])

  const downloadRecording = useCallback(() => {
    if (!recordingBlobRef.current) return
    const url = URL.createObjectURL(recordingBlobRef.current)
    const a = document.createElement('a')
    a.href = url
    a.download = `recording-${Date.now()}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }, [])
```

- [ ] **Step 4: Run all hook tests**

```bash
npx jest src/hooks/__tests__/useAudioMixer.test.ts --no-coverage
```

Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAudioMixer.ts src/hooks/__tests__/useAudioMixer.test.ts
git commit -m "feat: add recording to useAudioMixer (getDisplayMedia + MediaRecorder)"
```

---

## Task 3: `PitchVisualizer` component

**Files:**
- Create: `src/components/PitchVisualizer.tsx`
- Create: `src/components/__tests__/PitchVisualizer.test.tsx`

---

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/PitchVisualizer.test.tsx`:

```typescript
import { render } from '@testing-library/react'
import PitchVisualizer from '../PitchVisualizer'

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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/components/__tests__/PitchVisualizer.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '../PitchVisualizer'`

- [ ] **Step 3: Implement `PitchVisualizer`**

Create `src/components/PitchVisualizer.tsx`:

```typescript
'use client'

import { useEffect, useRef } from 'react'

interface PitchVisualizerProps {
  analyserNode: AnalyserNode | null
}

// Autocorrelation pitch detection — returns fundamental frequency in Hz, or -1 if silence
function detectPitch(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length
  const MAX = Math.floor(SIZE / 2)
  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.01) return -1

  let bestOffset = -1
  let bestCorr = 0
  let lastCorr = 1
  for (let offset = 1; offset < MAX; offset++) {
    let corr = 0
    for (let i = 0; i < MAX; i++) corr += Math.abs(buffer[i] - buffer[i + offset])
    corr = 1 - corr / MAX
    if (corr > 0.9 && corr > lastCorr) { bestCorr = corr; bestOffset = offset }
    lastCorr = corr
  }
  return bestCorr > 0.01 && bestOffset > 0 ? sampleRate / bestOffset : -1
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function freqToNote(freq: number): string {
  if (freq <= 0) return '--'
  const midi = Math.round(12 * Math.log2(freq / 440) + 69)
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`
}

export default function PitchVisualizer({ analyserNode }: PitchVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const pitchHistoryRef = useRef<number[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyserNode) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sampleRate = (analyserNode.context as AudioContext).sampleRate
    const timeData = new Float32Array(analyserNode.fftSize)
    const freqData = new Uint8Array(analyserNode.frequencyBinCount)
    const HISTORY = 120   // ~3 s at 40 fps

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      analyserNode!.getFloatTimeDomainData(timeData)
      analyserNode!.getByteFrequencyData(freqData)

      const W = canvas!.width
      const H = canvas!.height
      ctx!.clearRect(0, 0, W, H)

      // ── Volume bar (bottom 25%) ──────────────────────────────────────────
      const volH = Math.floor(H * 0.25)
      const volY = H - volH
      let sum = 0
      for (let i = 0; i < freqData.length; i++) sum += freqData[i]
      const vol = sum / freqData.length / 255
      ctx!.fillStyle = 'rgba(74,222,128,0.12)'
      ctx!.fillRect(0, volY, W, volH)
      ctx!.fillStyle = '#4ade80'
      ctx!.fillRect(0, volY, W * vol, volH)

      // ── Pitch history (top 75%) ──────────────────────────────────────────
      const pitchH = volY
      const MIN_FREQ = 80
      const MAX_FREQ = 1000
      const freq = detectPitch(timeData, sampleRate)
      pitchHistoryRef.current.push(freq)
      if (pitchHistoryRef.current.length > HISTORY) pitchHistoryRef.current.shift()

      ctx!.strokeStyle = '#60a5fa'
      ctx!.lineWidth = 1.5
      ctx!.beginPath()
      let started = false
      pitchHistoryRef.current.forEach((f, i) => {
        if (f <= 0) return
        const x = (i / HISTORY) * W
        const y = pitchH - (Math.log2(Math.max(f, MIN_FREQ) / MIN_FREQ) / Math.log2(MAX_FREQ / MIN_FREQ)) * pitchH
        if (!started) { ctx!.moveTo(x, y); started = true }
        else ctx!.lineTo(x, y)
      })
      ctx!.stroke()

      // ── Labels ───────────────────────────────────────────────────────────
      if (freq > 0) {
        ctx!.fillStyle = '#60a5fa'
        ctx!.font = '11px monospace'
        ctx!.fillText(freqToNote(freq), 4, 14)
      }
      const db = vol > 0 ? Math.round(20 * Math.log10(vol)) : null
      ctx!.fillStyle = '#4ade80'
      ctx!.font = '11px monospace'
      ctx!.fillText(db !== null ? `${db}dB` : '-∞', 4, H - 4)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyserNode])

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={120}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest src/components/__tests__/PitchVisualizer.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PitchVisualizer.tsx src/components/__tests__/PitchVisualizer.test.tsx
git commit -m "feat: add PitchVisualizer component with autocorrelation pitch detection"
```

---

## Task 4: `MixerPanel` component

**Files:**
- Create: `src/components/MixerPanel.tsx`
- Create: `src/components/__tests__/MixerPanel.test.tsx`

---

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/MixerPanel.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/components/__tests__/MixerPanel.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '../MixerPanel'`

- [ ] **Step 3: Implement `MixerPanel`**

Create `src/components/MixerPanel.tsx`:

```typescript
'use client'

import PitchVisualizer from '@/components/PitchVisualizer'

interface MixerPanelProps {
  isMonitoring: boolean
  isRecording: boolean
  recordingTime: number
  micVolume: number
  reverbAmount: number
  echoAmount: number
  analyserNode: AnalyserNode | null
  hasRecording: boolean
  error: string | null
  onToggleMonitor: () => void
  onSetMicVolume: (v: number) => void
  onSetReverb: (v: number) => void
  onSetEcho: (v: number) => void
  onStartRecording: () => void
  onStopRecording: () => void
  onDownload: () => void
  onClose: () => void
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-2)' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--color-accent)' }}>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={0} max={1} step={0.01}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: 'var(--color-accent)' }}
      />
    </div>
  )
}

export default function MixerPanel({
  isMonitoring, isRecording, recordingTime, micVolume, reverbAmount, echoAmount,
  analyserNode, hasRecording, error,
  onToggleMonitor, onSetMicVolume, onSetReverb, onSetEcho,
  onStartRecording, onStopRecording, onDownload, onClose,
}: MixerPanelProps) {
  return (
    <div className="p-3" style={{ background: 'var(--color-surface)' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>🎛 调音台</span>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent-glow)', color: 'var(--color-text-2)', border: '1px solid var(--accent-border)' }}
          >
            ⚠ 建议戴耳机
          </span>
          {error && <span className="text-xs" style={{ color: '#F87171' }}>{error}</span>}
          <button
            onClick={onClose}
            aria-label="关闭调音台"
            className="flex items-center justify-center w-5 h-5 rounded-full transition-all hover:brightness-150"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)' }}
          >
            <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Three-column grid */}
      <div className="grid grid-cols-3 gap-3">

        {/* Left: mic controls */}
        <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-3 font-medium" style={{ color: 'var(--color-text-3)' }}>🎤 麦克风</p>
          <Slider label="麦克风音量" value={micVolume} onChange={onSetMicVolume} />
          <Slider label="混响" value={reverbAmount} onChange={onSetReverb} />
          <Slider label="回声" value={echoAmount} onChange={onSetEcho} />
          <button
            onClick={onToggleMonitor}
            aria-label="监听开关"
            className="mt-1 w-full text-xs py-1.5 rounded-full transition-all hover:brightness-110 active:scale-95"
            style={isMonitoring
              ? { background: 'var(--accent-glow)', border: '1px solid var(--accent-border)', color: 'var(--color-accent)' }
              : { background: 'var(--color-surface-3)', border: '1px solid var(--border-subtle)', color: 'var(--color-text-3)' }
            }
          >
            👂 监听：{isMonitoring ? '开' : '关'}
          </button>
        </div>

        {/* Middle: visualizer */}
        <div className="rounded-lg p-3 flex flex-col" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-2 font-medium" style={{ color: 'var(--color-text-3)' }}>📊 实时走势</p>
          <div className="flex-1 rounded overflow-hidden min-h-0" style={{ background: 'var(--color-bg)' }}>
            <PitchVisualizer analyserNode={analyserNode} />
          </div>
        </div>

        {/* Right: recording */}
        <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-3 font-medium" style={{ color: 'var(--color-text-3)' }}>⏺ 录音</p>

          {!isRecording && (
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-3)' }}>需选择"共享标签页音频"</p>
          )}

          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            aria-label={isRecording ? '停止录音' : '开始录音'}
            className="w-full text-xs py-2 rounded-full mb-3 transition-all hover:brightness-110 active:scale-95"
            style={isRecording
              ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#F87171' }
              : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5' }
            }
          >
            {isRecording ? '⏹ 停止录音' : '⏺ 开始录音'}
          </button>

          <div
            className="rounded p-2 text-center mb-3"
            style={{ background: 'var(--color-bg)', fontFamily: 'monospace' }}
          >
            <span className="text-lg" style={{ color: isRecording ? '#F87171' : 'var(--color-text-3)' }}>
              {formatTime(recordingTime)}
            </span>
          </div>

          <button
            onClick={onDownload}
            aria-label="下载录音"
            disabled={!hasRecording}
            className="w-full text-xs py-1.5 rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-surface-3)', border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)' }}
          >
            ⬇ 下载录音
          </button>
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest src/components/__tests__/MixerPanel.test.tsx --no-coverage
```

Expected: PASS — all 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/MixerPanel.tsx src/components/__tests__/MixerPanel.test.tsx
git commit -m "feat: add MixerPanel component with three-column layout"
```

---

## Task 5: `MixerDrawer` component

**Files:**
- Create: `src/components/MixerDrawer.tsx`
- Create: `src/components/__tests__/MixerDrawer.test.tsx`

---

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/MixerDrawer.test.tsx`:

```typescript
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

jest.mock('@/hooks/useAudioMixer', () => ({
  useAudioMixer: () => mockMixer,
}))

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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/components/__tests__/MixerDrawer.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '../MixerDrawer'`

- [ ] **Step 3: Implement `MixerDrawer`**

Create `src/components/MixerDrawer.tsx`:

```typescript
'use client'

import MixerPanel from '@/components/MixerPanel'
import { useAudioMixer } from '@/hooks/useAudioMixer'

export default function MixerDrawer() {
  const mixer = useAudioMixer()

  return (
    <>
      {/* Trigger button — always visible at page bottom */}
      <div
        className="shrink-0 flex justify-center py-2"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <button
          onClick={mixer.openDrawer}
          aria-label="打开调音台"
          className="text-xs px-4 py-1.5 rounded-full font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
          style={{
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent-border)',
            color: 'var(--color-accent)',
          }}
        >
          🎛 调音台
        </button>
      </div>

      {/* Drawer — slides in from bottom */}
      <div
        className="shrink-0 overflow-hidden transition-all duration-300"
        style={{
          maxHeight: mixer.isOpen ? '220px' : '0px',
          borderTop: mixer.isOpen ? '1px solid var(--border-subtle)' : undefined,
        }}
      >
        {mixer.isOpen && (
          <MixerPanel
            isMonitoring={mixer.isMonitoring}
            isRecording={mixer.isRecording}
            recordingTime={mixer.recordingTime}
            micVolume={mixer.micVolume}
            reverbAmount={mixer.reverbAmount}
            echoAmount={mixer.echoAmount}
            analyserNode={mixer.analyserNode}
            hasRecording={mixer.hasRecording}
            error={mixer.error}
            onToggleMonitor={mixer.toggleMonitor}
            onSetMicVolume={mixer.setMicVolume}
            onSetReverb={mixer.setReverb}
            onSetEcho={mixer.setEcho}
            onStartRecording={mixer.startRecording}
            onStopRecording={mixer.stopRecording}
            onDownload={mixer.downloadRecording}
            onClose={mixer.closeDrawer}
          />
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest src/components/__tests__/MixerDrawer.test.tsx --no-coverage
```

Expected: PASS — all 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/MixerDrawer.tsx src/components/__tests__/MixerDrawer.test.tsx
git commit -m "feat: add MixerDrawer component with slide-in animation"
```

---

## Task 6: Wire up to song page

**Files:**
- Modify: `src/app/song/[id]/page.tsx`

---

- [ ] **Step 1: Add `MixerDrawer` import**

At the top of `src/app/song/[id]/page.tsx`, add after the existing imports:

```typescript
import MixerDrawer from '@/components/MixerDrawer'
```

- [ ] **Step 2: Add `<MixerDrawer />` to the page JSX**

In `src/app/song/[id]/page.tsx`, find the `<LoopController>` line at the bottom of the main return:

```typescript
      <LoopController loopLine={loopLine} onExit={() => setLoopLine(null)} />
    </div>
```

Replace with:

```typescript
      <LoopController loopLine={loopLine} onExit={() => setLoopLine(null)} />
      <MixerDrawer />
    </div>
```

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: All tests pass (existing + new)

- [ ] **Step 4: Start dev server and verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000`, search for any song, open its player page. Verify:
- "🎛 调音台" button appears at the bottom of the page
- Clicking it opens the drawer (browser prompts for mic permission)
- Mic volume / reverb / echo sliders respond
- 监听 toggle button works (can hear yourself through headphones)
- 开始录音 button opens the share-tab-audio system dialog
- Timer counts up while recording
- 停止录音 stops the recorder
- 下载录音 button activates and downloads a `.webm` file
- Closing the drawer collapses the panel

- [ ] **Step 5: Commit**

```bash
git add src/app/song/[id]/page.tsx
git commit -m "feat: add MixerDrawer to song page — audio mixer complete"
```
