# Live Pitch Visualizer Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-start the mic pipeline on page load, fix missing Y-axis labels in active mode, and replace sparse octave ticks with C+A note markers covering the full vocal range.

**Architecture:** `initMic()` is extracted from `openDrawer` in `useAudioMixer` so the pipeline can be started without opening the drawer UI. `SongPage` calls it on mount. `PitchVisualizer` is updated to draw labelled guide lines in active mode and removes the unused volume bar.

**Tech Stack:** React, TypeScript, Web Audio API, HTML Canvas, Jest / Testing Library

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/useAudioMixer.ts` | Extract `initMic()` from `openDrawer`; expose in return |
| `src/hooks/__tests__/useAudioMixer.test.ts` | Add tests for `initMic` |
| `src/components/PitchVisualizer.tsx` | Replace `OCTAVE_FREQS` → `GUIDE_NOTES`, add labels in draw loop, remove volume bar |
| `src/components/__tests__/MixerDrawer.test.tsx` | Add `initMic` to `mockMixer` |
| `src/app/song/[id]/page.tsx` | Call `mixer.initMic()` on mount |

---

## Task 1: Add `initMic` to `useAudioMixer`

**Files:**
- Modify: `src/hooks/__tests__/useAudioMixer.test.ts`
- Modify: `src/hooks/useAudioMixer.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/hooks/__tests__/useAudioMixer.test.ts` after the existing `openDrawer` describe block:

```typescript
describe('useAudioMixer — initMic', () => {
  it('exposes analyserNode without opening drawer', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.initMic() })
    expect(result.current.isOpen).toBe(false)
    expect(result.current.analyserNode).toBe(mockAnalyser)
  })

  it('requests microphone', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.initMic() })
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false })
  })

  it('sets error when permission is denied', async () => {
    ;(navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(
      new DOMException('Permission denied', 'NotAllowedError')
    )
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.initMic() })
    expect(result.current.error).toBe('需要麦克风权限')
    expect(result.current.isOpen).toBe(false)
  })

  it('is idempotent — second call resumes ctx without rebuilding', async () => {
    const { result } = renderHook(() => useAudioMixer())
    await act(async () => { result.current.initMic() })
    await act(async () => { result.current.initMic() })
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
    expect(mockCtx.resume).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/hooks/__tests__/useAudioMixer.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `result.current.initMic is not a function`

- [ ] **Step 3: Implement `initMic` and refactor `openDrawer`**

In `src/hooks/useAudioMixer.ts`, replace the `openDrawer` callback (lines 104–121) with:

```typescript
const initMic = useCallback(async () => {
  if (nodesRef.current) { await nodesRef.current.ctx.resume(); return }
  if (buildingRef.current) return
  buildingRef.current = true
  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    const nodes = await buildPipeline(micStream)
    nodesRef.current = nodes
    setAnalyserNode(nodes.analyser)
    setError(null)
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    setError(name === 'NotFoundError' ? '未检测到麦克风设备' : '需要麦克风权限')
  } finally {
    buildingRef.current = false
  }
}, [])

const openDrawer = useCallback(async () => {
  setIsOpen(true)
  await initMic()
}, [initMic])
```

Then add `initMic` to the return object at the bottom of the hook (after `openDrawer`):

```typescript
return {
  isOpen, isMonitoring, isRecording, recordingTime,
  micVolume, reverbAmount, echoAmount,
  analyserNode, error, hasRecording,
  initMic, openDrawer, closeDrawer, toggleMonitor,
  setMicVolume, setReverb, setEcho,
  startRecording, stopRecording, downloadRecording,
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/hooks/__tests__/useAudioMixer.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAudioMixer.ts src/hooks/__tests__/useAudioMixer.test.ts
git commit -m "feat: add initMic() to useAudioMixer — starts pipeline without opening drawer"
```

---

## Task 2: Fix `MixerDrawer` mock and auto-init in `SongPage`

**Files:**
- Modify: `src/components/__tests__/MixerDrawer.test.tsx`
- Modify: `src/app/song/[id]/page.tsx`

- [ ] **Step 1: Add `initMic` to the mock object in `MixerDrawer.test.tsx`**

In `src/components/__tests__/MixerDrawer.test.tsx`, add `initMic: jest.fn()` to `mockMixer` (after line 15, between `analyserNode` and `hasRecording`):

```typescript
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
```

- [ ] **Step 2: Run MixerDrawer tests to confirm they still pass**

```bash
npx jest src/components/__tests__/MixerDrawer.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: all tests PASS

- [ ] **Step 3: Add `initMic` call on mount in `SongPage`**

In `src/app/song/[id]/page.tsx`, add a `useEffect` after the existing fetch effect (after line 55). Insert after the `useEffect` that fetches song data:

```typescript
useEffect(() => {
  mixer.initMic()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

- [ ] **Step 4: Commit**

```bash
git add src/components/__tests__/MixerDrawer.test.tsx src/app/song/[id]/page.tsx
git commit -m "feat: auto-init mic pipeline on song page mount"
```

---

## Task 3: Fix `PitchVisualizer` — guide notes, labels, remove volume bar

**Files:**
- Modify: `src/components/PitchVisualizer.tsx`

No additional test file needed — canvas rendering is not testable in jsdom. The pure-function correctness (freqToNote, freqToY) is verified by the type system and by visual inspection after running the dev server.

- [ ] **Step 1: Replace `OCTAVE_FREQS` with `GUIDE_NOTES` and update `MIN_FREQ` / `MAX_FREQ`**

In `src/components/PitchVisualizer.tsx`, replace lines 32–47 (the constants block) with:

```typescript
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const MIN_FREQ = 65    // C2
const MAX_FREQ = 1047  // C6

function freqToNote(freq: number): string {
  if (freq <= 0) return '--'
  const midi = Math.round(12 * Math.log2(freq / 440) + 69)
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`
}

function freqToY(freq: number, H: number): number {
  return H - (Math.log2(Math.max(freq, MIN_FREQ) / MIN_FREQ) / Math.log2(MAX_FREQ / MIN_FREQ)) * H
}

interface GuideNote { freq: number; label: string; primary: boolean }
const GUIDE_NOTES: GuideNote[] = [
  { freq: 65,   label: 'C2',   primary: true },
  { freq: 110,  label: 'A2',   primary: false },
  { freq: 131,  label: 'C3',   primary: true },
  { freq: 220,  label: 'A3',   primary: false },
  { freq: 262,  label: 'C4 ♩', primary: true },
  { freq: 440,  label: 'A4',   primary: false },
  { freq: 523,  label: 'C5',   primary: true },
  { freq: 880,  label: 'A5',   primary: false },
  { freq: 1047, label: 'C6',   primary: true },
]
```

- [ ] **Step 2: Update the placeholder drawing path to use `GUIDE_NOTES`**

Replace the `drawPlaceholder` function body (inside the `if (!analyserNode)` branch, lines ~76–97) with:

```typescript
function drawPlaceholder() {
  const W = canvas!.width || 300
  const H = canvas!.height || 120
  ctx!.clearRect(0, 0, W, H)
  ctx!.font = '9px monospace'
  GUIDE_NOTES.forEach(({ freq, label, primary }) => {
    const y = freqToY(freq, H)
    ctx!.strokeStyle = primary ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.08)'
    ctx!.lineWidth = 1
    ctx!.beginPath()
    ctx!.moveTo(0, y)
    ctx!.lineTo(W, y)
    ctx!.stroke()
    ctx!.fillStyle = primary ? 'rgba(96,165,250,0.35)' : 'rgba(96,165,250,0.18)'
    ctx!.fillText(label, 3, y - 2)
  })
}
```

- [ ] **Step 3: Update the active `draw()` loop — remove volume bar, add labels**

Replace the entire `draw` function (lines ~106–170) with:

```typescript
function draw() {
  rafRef.current = requestAnimationFrame(draw)
  frameCountRef.current++
  analyserNode!.getFloatTimeDomainData(timeData)

  const W = canvas!.width || 1
  const H = canvas!.height || 1
  ctx!.clearRect(0, 0, W, H)

  // ── Guide lines + labels ────────────────────────────────────────────────
  ctx!.font = '9px monospace'
  GUIDE_NOTES.forEach(({ freq, label, primary }) => {
    const y = freqToY(freq, H)
    ctx!.strokeStyle = primary ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.08)'
    ctx!.lineWidth = 1
    ctx!.beginPath()
    ctx!.moveTo(0, y)
    ctx!.lineTo(W, y)
    ctx!.stroke()
    ctx!.fillStyle = primary ? 'rgba(96,165,250,0.35)' : 'rgba(96,165,250,0.18)'
    ctx!.fillText(label, 3, y - 2)
  })

  // ── Pitch history ───────────────────────────────────────────────────────
  let freq = pitchHistoryRef.current[pitchHistoryRef.current.length - 1] ?? -1
  if (frameCountRef.current % DATA_EVERY === 0) {
    freq = detectPitch(timeData, sampleRate)
    pitchHistoryRef.current.push(freq)
    if (pitchHistoryRef.current.length > HISTORY) pitchHistoryRef.current.shift()
  }

  ctx!.strokeStyle = '#60a5fa'
  ctx!.lineWidth = 1.5
  ctx!.beginPath()
  let started = false
  pitchHistoryRef.current.forEach((f, i) => {
    if (f <= 0) return
    const x = (i / HISTORY) * W
    const y = freqToY(f, H)
    if (!started) { ctx!.moveTo(x, y); started = true }
    else ctx!.lineTo(x, y)
  })
  ctx!.stroke()

  // ── Current note label ──────────────────────────────────────────────────
  if (freq > 0) {
    ctx!.fillStyle = '#60a5fa'
    ctx!.font = 'bold 11px monospace'
    ctx!.fillText(freqToNote(freq), W - 32, 14)
  }
}
```

Also remove the `freqData` / `Uint8Array` line (it was only used by the volume bar):

In the same `useEffect`, replace:
```typescript
const timeData = new Float32Array(analyserNode.fftSize)
const freqData = new Uint8Array(analyserNode.frequencyBinCount)
```
with:
```typescript
const timeData = new Float32Array(analyserNode.fftSize)
```

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: all existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PitchVisualizer.tsx
git commit -m "feat: fix PitchVisualizer — vocal-range guide notes with labels, remove volume bar"
```

---

## Task 4: Verify visually in the dev server

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open a song page**

Navigate to `http://localhost:3000`, open any song. Browser should immediately prompt for mic permission.

- [ ] **Step 3: Check the pitch panel**

After granting permission, the canvas should show:
- All 9 guide lines (C2–C6 + A2–A5) with labels on the left
- C notes brighter than A notes
- Pitch curve appearing as you speak/sing
- Current note name in the top-right corner
- No volume bar at the bottom

- [ ] **Step 4: Final commit if any visual tweaks were made**

```bash
git add -p
git commit -m "fix: visual tweaks to PitchVisualizer after browser testing"
```
