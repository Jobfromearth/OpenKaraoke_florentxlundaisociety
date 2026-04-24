'use client'

import MixerPanel from '@/components/MixerPanel'
import type { useAudioMixer } from '@/hooks/useAudioMixer'
import { useUILang } from '@/components/UILangProvider'

type MixerState = ReturnType<typeof useAudioMixer>

export default function MixerDrawer({ mixer }: { mixer: MixerState }) {
  const { t } = useUILang()

  return (
    <>
      {/* Trigger button — always visible at page bottom */}
      <div
        className="shrink-0 flex justify-center py-2"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <button
          onClick={mixer.openDrawer}
          aria-label={t.mixer}
          className="text-xs px-4 py-1.5 rounded-full font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
          style={{
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent-border)',
            color: 'var(--color-accent)',
          }}
        >
          🎛 {t.mixer}
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
