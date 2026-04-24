# Unify Language & Enlarge Lyrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all UI language strings across all pages (homepage, performance page, mixer, search bar, buttons) with the selected language option, enlarge font when singing each line, and remove the Spanish button from the homepage.

**Architecture:** Use the existing `useUILang()` hook to replace all hardcoded Chinese strings with translated text from the i18n system. Add missing translation keys for SearchBar, PhoneticToggle, MixerDrawer, and MixerPanel. Enlarge font sizes for active lyric lines using Tailwind's text size classes.

**Tech Stack:** React, TypeScript, Next.js, Tailwind CSS, i18n translations

---

## Task 1: Add Missing i18n Translation Keys

**Files:**
- Modify: `src/lib/i18n.ts:5-166`

**Explanation:**
The i18n system is missing keys for SearchBar placeholders, buttons, and mixer labels. We need to add these keys to the translations object for all three languages (zh, en, sv).

- [ ] **Step 1: Update i18n.ts to add missing keys**

Replace the `Translations` interface and translations object to include all missing keys:

```typescript
// In the Translations interface, add after line 29:
searchPlaceholder: string;
searchButton: string;
searchingButton: string;
searchError: string;
showPhoneticLabel: string;
hidePhoneticLabel: string;
```

Add the values to each language translation:

For `zh`:
```typescript
searchPlaceholder: '搜索歌曲名 / 歌手...',
searchButton: '搜索',
searchingButton: '搜索中...',
searchError: '搜索失败，请重试',
showPhoneticLabel: '显示音译',
hidePhoneticLabel: '隐藏音译',
```

For `en`:
```typescript
searchPlaceholder: 'Search song / artist…',
searchButton: 'Search',
searchingButton: 'Searching…',
searchError: 'Search failed, please try again',
showPhoneticLabel: 'Show phonetics',
hidePhoneticLabel: 'Hide phonetics',
```

For `sv`:
```typescript
searchPlaceholder: 'Sök låt / artist…',
searchButton: 'Sök',
searchingButton: 'Söker…',
searchError: 'Sökning misslyckades, försök igen',
showPhoneticLabel: 'Visa fonetik',
hidePhoneticLabel: 'Dölj fonetik',
```

- [ ] **Step 2: Commit the i18n changes**

```bash
git add src/lib/i18n.ts
git commit -m "feat: add missing i18n keys for SearchBar and PhoneticToggle"
```

---

## Task 2: Update SearchBar to Use i18n

**Files:**
- Modify: `src/components/SearchBar.tsx:1-76`

**Explanation:**
SearchBar has hardcoded Chinese strings. We'll import `useUILang()` and replace all hardcoded strings with translations.

- [ ] **Step 1: Add useUILang import**

```typescript
import { useUILang } from '@/components/UILangProvider'
```

- [ ] **Step 2: Update SearchBar component to use i18n**

```typescript
export default function SearchBar({ onSelect, language }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useUILang()  // Add this line

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error(t.searchError)  // Changed from hardcoded Chinese
      setResults(await res.json())
    } catch {
      setError(t.searchError)  // Changed from hardcoded Chinese
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative w-full max-w-xl">
      <form role="search" onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder={t.searchPlaceholder}  // Changed from hardcoded Chinese
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? t.searchingButton : t.searchButton}  // Changed from hardcoded Chinese
        </button>
      </form>

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

      {results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow-lg z-10 max-h-80 overflow-y-auto">
          {results.map(result => (
            <li key={result.videoId}>
              <button
                onClick={() => { onSelect({ ...result, language, query }); setResults([]) }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
              >
                {result.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.thumbnailUrl} alt="" className="w-12 h-9 object-cover rounded" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{result.title}</p>
                  <p className="text-xs text-gray-500 truncate">{result.channelTitle}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit the SearchBar changes**

```bash
git add src/components/SearchBar.tsx
git commit -m "feat: unify SearchBar language with UILang setting"
```

---

## Task 3: Update PhoneticToggle to Use i18n

**Files:**
- Modify: `src/components/PhoneticToggle.tsx:1-21`

**Explanation:**
PhoneticToggle has hardcoded Chinese strings. We'll import `useUILang()` and replace with translations.

- [ ] **Step 1: Update PhoneticToggle component**

```typescript
'use client'

import { useUILang } from '@/components/UILangProvider'

interface PhoneticToggleProps {
  showPhonetic: boolean
  onToggle: () => void
}

export default function PhoneticToggle({ showPhonetic, onToggle }: PhoneticToggleProps) {
  const { t } = useUILang()  // Add this line

  return (
    <button
      onClick={onToggle}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        showPhonetic
          ? 'bg-blue-50 border-blue-300 text-blue-700'
          : 'bg-gray-50 border-gray-300 text-gray-500'
      }`}
    >
      {showPhonetic ? t.hidePhoneticLabel : t.showPhoneticLabel}  {/* Changed from hardcoded */}
    </button>
  )
}
```

- [ ] **Step 2: Commit the PhoneticToggle changes**

```bash
git add src/components/PhoneticToggle.tsx
git commit -m "feat: unify PhoneticToggle language with UILang setting"
```

---

## Task 4: Update MixerDrawer to Use i18n

**Files:**
- Modify: `src/components/MixerDrawer.tsx:1-63`

**Explanation:**
MixerDrawer button has a hardcoded Chinese label. We'll import `useUILang()` and replace it.

- [ ] **Step 1: Update MixerDrawer component**

```typescript
'use client'

import MixerPanel from '@/components/MixerPanel'
import { useUILang } from '@/components/UILangProvider'  // Add import
import type { useAudioMixer } from '@/hooks/useAudioMixer'

type MixerState = ReturnType<typeof useAudioMixer>

export default function MixerDrawer({ mixer }: { mixer: MixerState }) {
  const { t } = useUILang()  // Add this line

  return (
    <>
      {/* Trigger button — always visible at page bottom */}
      <div
        className="shrink-0 flex justify-center py-2"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <button
          onClick={mixer.openDrawer}
          aria-label={t.mixer}  // Changed from hardcoded Chinese
          className="text-xs px-4 py-1.5 rounded-full font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
          style={{
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent-border)',
            color: 'var(--color-accent)',
          }}
        >
          🎛 {t.mixer}  {/* Changed from hardcoded Chinese */}
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

- [ ] **Step 2: Commit the MixerDrawer changes**

```bash
git add src/components/MixerDrawer.tsx
git commit -m "feat: unify MixerDrawer language with UILang setting"
```

---

## Task 5: Update MixerPanel to Use i18n

**Files:**
- Modify: `src/components/MixerPanel.tsx:1-157`

**Explanation:**
MixerPanel has many hardcoded Chinese strings. We'll import `useUILang()` and replace all hardcoded text with translations.

- [ ] **Step 1: Update MixerPanel component imports**

Add import:
```typescript
import { useUILang } from '@/components/UILangProvider'
```

- [ ] **Step 2: Update MixerPanel component implementation**

```typescript
export default function MixerPanel({
  isMonitoring, isRecording, recordingTime, micVolume, reverbAmount, echoAmount,
  analyserNode, hasRecording, error,
  onToggleMonitor, onSetMicVolume, onSetReverb, onSetEcho,
  onStartRecording, onStopRecording, onDownload, onClose,
}: MixerPanelProps) {
  const { t } = useUILang()  // Add this line

  return (
    <div className="p-3" style={{ background: 'var(--color-surface)' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>🎛 {t.mixer}</span>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent-glow)', color: 'var(--color-text-2)', border: '1px solid var(--accent-border)' }}
          >
            ⚠ {t.mixerHeadphone}
          </span>
          {error && <span className="text-xs" style={{ color: '#F87171' }}>{error}</span>}
          <button
            onClick={onClose}
            aria-label={t.mixer}
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
          <p className="text-xs mb-3 font-medium" style={{ color: 'var(--color-text-3)' }}>🎤 {t.mixerMicSection}</p>
          <Slider label={t.mixerMicVolume} value={micVolume} onChange={onSetMicVolume} />
          <Slider label={t.mixerReverb} value={reverbAmount} onChange={onSetReverb} />
          <Slider label={t.mixerEcho} value={echoAmount} onChange={onSetEcho} />
          <button
            onClick={onToggleMonitor}
            aria-label={isMonitoring ? t.mixerMonitorOn : t.mixerMonitorOff}
            className="mt-1 w-full text-xs py-1.5 rounded-full transition-all hover:brightness-110 active:scale-95"
            style={isMonitoring
              ? { background: 'var(--accent-glow)', border: '1px solid var(--accent-border)', color: 'var(--color-accent)' }
              : { background: 'var(--color-surface-3)', border: '1px solid var(--border-subtle)', color: 'var(--color-text-3)' }
            }
          >
            👂 {isMonitoring ? t.mixerMonitorOn : t.mixerMonitorOff}
          </button>
        </div>

        {/* Middle: visualizer */}
        <div className="rounded-lg p-3 flex flex-col" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-2 font-medium" style={{ color: 'var(--color-text-3)' }}>📊 {t.mixerTrend}</p>
          <div className="flex-1 rounded overflow-hidden min-h-0" style={{ background: 'var(--color-bg)' }}>
            <PitchVisualizer analyserNode={analyserNode} />
          </div>
        </div>

        {/* Right: recording */}
        <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-3 font-medium" style={{ color: 'var(--color-text-3)' }}>⏺ {t.mixerRecordSection}</p>

          {!isRecording && (
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-3)' }}>{t.mixerRecordNote}</p>
          )}

          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            aria-label={isRecording ? t.mixerStopRecording : t.mixerStartRecording}
            className="w-full text-xs py-2 rounded-full mb-3 transition-all hover:brightness-110 active:scale-95"
            style={isRecording
              ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#F87171' }
              : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5' }
            }
          >
            {isRecording ? `⏹ ${t.mixerStopRecording}` : `⏺ ${t.mixerStartRecording}`}
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
            aria-label={t.mixerDownload}
            disabled={!hasRecording}
            className="w-full text-xs py-1.5 rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-surface-3)', border: '1px solid var(--border-subtle)', color: 'var(--color-text-2)' }}
          >
            ⬇ {t.mixerDownload}
          </button>
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit the MixerPanel changes**

```bash
git add src/components/MixerPanel.tsx
git commit -m "feat: unify MixerPanel language with UILang setting"
```

---

## Task 6: Enlarge Font Size for Active Lyric Lines

**Files:**
- Modify: `src/components/LyricLine.tsx:22-75`

**Explanation:**
When a lyric line is active (being sung), we should increase the font size to make it more prominent. We'll change the base text class from `text-base` to a larger size when `isActive` is true.

- [ ] **Step 1: Update LyricLine component**

```typescript
export default function LyricLine({ line, isActive, showPhonetic, showTranslation, progress, onClick }: LyricLineProps) {
  const activeSegmentIndex = isActive && progress > 0
    ? Math.floor(progress * line.segments.length)
    : line.segments.length // all lit when not in scan mode

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-colors cursor-pointer ${
        isActive ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'hover:bg-gray-50'
      }`}
    >
      {/* Original text row */}
      <div className={`flex flex-wrap gap-x-2 font-medium ${isActive ? 'text-xl' : 'text-base'}`}>
        {line.segments.length > 0 ? (
          line.segments.map((seg, i) => {
            const colors = COLOR_CLASSES[seg.color % 5]
            const isLit = i <= activeSegmentIndex
            return (
              <span key={i} className={isLit ? colors.text : colors.dim}>
                {seg.original}
              </span>
            )
          })
        ) : (
          <span className={isActive ? 'text-gray-900' : 'text-gray-600'}>{line.text}</span>
        )}
      </div>

      {/* Phonetic row */}
      {showPhonetic && (
        <div className={`flex flex-wrap gap-x-2 mt-0.5 ${isActive ? 'text-base' : 'text-sm'}`}>
          {line.segments.length > 0 ? (
            line.segments.map((seg, i) => {
              const colors = COLOR_CLASSES[seg.color % 5]
              const isLit = i <= activeSegmentIndex
              return (
                <span key={i} className={isLit ? colors.text : colors.dim}>
                  {seg.phonetic}
                </span>
              )
            })
          ) : (
            <span className="text-gray-400">{line.phonetic || '—'}</span>
          )}
        </div>
      )}

      {/* Translation row */}
      {showTranslation && line.translation && (
        <div className={`mt-0.5 text-gray-400 italic ${isActive ? 'text-sm' : 'text-xs'}`}>{line.translation}</div>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit the LyricLine changes**

```bash
git add src/components/LyricLine.tsx
git commit -m "feat: enlarge font size for active lyric lines"
```

---

## Task 7: Remove Spanish Button from Homepage

**Files:**
- Modify: `src/app/page.tsx:11-102`

**Explanation:**
Remove 'es' from the SONG_LANG_CODES array to remove the Spanish button from the homepage language filter.

- [ ] **Step 1: Update SONG_LANG_CODES**

Change line 11 from:
```typescript
const SONG_LANG_CODES = ['en', 'ja', 'ko', 'es', 'sv']
```

To:
```typescript
const SONG_LANG_CODES = ['en', 'ja', 'ko', 'sv']
```

- [ ] **Step 2: Commit the changes**

```bash
git add src/app/page.tsx
git commit -m "feat: remove Spanish button from homepage language filter"
```

---

## Summary

This plan:
1. Adds missing translation keys to the i18n system
2. Updates SearchBar to use `useUILang()` instead of hardcoded Chinese
3. Updates PhoneticToggle to use `useUILang()` instead of hardcoded Chinese
4. Updates MixerDrawer to use `useUILang()` instead of hardcoded Chinese
5. Updates MixerPanel to use `useUILang()` instead of hardcoded Chinese
6. Enlarges font sizes for active lyric lines (text-base → text-xl for original, text-sm → text-base for phonetic, text-xs → text-sm for translation)
7. Removes the Spanish button from the homepage

All language strings across the web UI will now respond to the language selector, providing a consistent user experience across all pages and components.
