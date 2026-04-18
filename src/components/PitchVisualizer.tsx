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
