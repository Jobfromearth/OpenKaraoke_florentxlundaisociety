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
