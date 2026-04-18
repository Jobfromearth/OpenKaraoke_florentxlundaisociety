# Live Pitch Visualizer Fix — Design Spec

**Date:** 2026-04-18  
**Status:** Approved

## Problem

Three issues with the live pitch feature on the song page:

1. **Not auto-starting** — `analyserNode` is `null` until the user manually opens the MixerDrawer. The visualizer shows only a static placeholder for the entire session unless the user discovers the drawer.
2. **Y-axis labels disappear in active mode** — Labels (C2, C3…) are drawn in the placeholder branch but omitted from the active drawing loop. Scale reference vanishes once the mic connects.
3. **Scale too sparse** — Only octave C boundaries are marked. A vocalist needs finer reference points to gauge pitch accuracy.

## Solution

### A. Auto-init mic on page load

Add `initMic(): Promise<void>` to `useAudioMixer`. It builds the audio pipeline (same as `openDrawer`) without setting `isOpen = true`. `SongPage` calls `mixer.initMic()` in a `useEffect` on mount.

- Mic permission dialog fires immediately on entering the song page.
- If permission is denied, the visualizer falls back to the existing placeholder (no error shown in the pitch panel — error state remains in MixerDrawer only).
- `openDrawer` calls `initMic` internally to avoid duplication.

### B. Y-axis labels in active mode

In the `draw()` loop inside `PitchVisualizer`, render note labels alongside every guide line — same style as the placeholder branch (monospace, faint blue). Labels are clipped to the left edge so they don't obstruct the pitch curve.

### C. Y-axis scale — C + A tick marks

**Range:** keep C2–C6 (65–1047 Hz). Covers bass through soprano.

**Tick marks:**

| Note | Freq (Hz) | Label |
|------|-----------|-------|
| C2   | 65        | C2    |
| A2   | 110       | A2    |
| C3   | 131       | C3    |
| A3   | 220       | A3    |
| C4   | 262       | C4 ♩ |
| A4   | 440       | A4    |
| C5   | 523       | C5    |
| A5   | 880       | A5    |
| C6   | 1047      | C6    |

C4 (middle C) is marked with ♩ as a visual anchor. C notes get a slightly brighter guide line than A notes.

### D. Remove volume bar

The bottom-25% volume bar is removed from `PitchVisualizer`. Volume feedback is already available in MixerDrawer. The freed space gives the pitch history curve more vertical resolution.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useAudioMixer.ts` | Add `initMic()`, refactor `openDrawer` to call it |
| `src/components/PitchVisualizer.tsx` | Fix active-mode labels, update tick marks, remove volume bar |
| `src/app/song/[id]/page.tsx` | Call `mixer.initMic()` on mount |

## Out of Scope

- Pitch accuracy algorithm changes
- MixerDrawer UI changes
- Mobile layout adjustments
