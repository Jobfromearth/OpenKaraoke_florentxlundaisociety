# Translation Feature Design

**Date:** 2026-04-18  
**Status:** Approved

## Summary

Add a per-line translation toggle to the song player page, parallel to the existing phonetic toggle. Translation language follows the phonetic language setting (user's native language).

## Data Layer

- Add `translation: string` to `LyricLine` in `src/lib/types.ts`
- `translation` stored inside the existing `lines` JSON column in `Lyrics` table — no schema migration needed
- Clear SQLite cache before shipping so all songs regenerate with translation included

## Backend

- Modify `callClaudePhonetics` prompt to also return a `translation` field per line in the same JSON response
- Format: `[{"index":0,"phonetic":"...","translation":"...","segments":[...]}]`
- Translation language = `phoneticLang` (same target language as phonetics)
- Merge `translation` into `LyricLine` alongside existing `phonetic` and `segments`

## Frontend

- New `TranslationToggle` component (mirrors `PhoneticToggle` exactly)
- `LyricsPanel` gains `showTranslation` prop, passes to `LyricLine`
- `LyricLine` renders translation row below phonetics row when `showTranslation` is true (smaller font, lower opacity, distinct from phonetics)
- `SongPage` header: two buttons side by side — phonetic toggle + translation toggle
- `i18n.ts`: add `showTranslation` / `hideTranslation` keys for zh/en/sv

## Out of Scope

- Per-segment word-level translation
- Separate translation language selector
- On-demand translation for already-cached songs (cache cleared instead)
