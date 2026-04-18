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
  let lastCorr = 1
  for (let offset = 1; offset < MAX; offset++) {
    let corr = 0
    for (let i = 0; i < MAX; i++) corr += Math.abs(buffer[i] - buffer[i + offset])
    corr = 1 - corr / MAX
    if (corr > 0.9 && corr > lastCorr) { bestOffset = offset; break }
    lastCorr = corr
  }
  return bestOffset > 0 ? sampleRate / bestOffset : -1
}

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

const HISTORY = 120
const DATA_EVERY = 4  // ≈15fps pitch samples → ~8s visible window

export default function PitchVisualizer({ analyserNode }: PitchVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const pitchHistoryRef = useRef<number[]>([])
  const frameCountRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    if (!canvas || !ctx) return

    if (!analyserNode) {
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
      // Single observer: resize canvas buffer then redraw — avoids ordering ambiguity
      const ro = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect
        canvas.width = Math.round(width) || 1
        canvas.height = Math.round(height) || 1
        drawPlaceholder()
      })
      ro.observe(canvas)
      drawPlaceholder()
      return () => ro.disconnect()
    }

    // Active mode: sizing observer (RAF loop handles redraw each frame)
    frameCountRef.current = 0
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      canvas.width = Math.round(width) || 1
      canvas.height = Math.round(height) || 1
    })
    ro.observe(canvas)

    const sampleRate = (analyserNode.context as AudioContext).sampleRate
    const timeData = new Float32Array(analyserNode.fftSize)

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

    draw()
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [analyserNode])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
