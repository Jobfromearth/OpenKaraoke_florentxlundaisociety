# Phonetic Language Selection Design

**Date:** 2026-04-18  
**Status:** Approved

## Summary

Allow users to choose their native language for phonetic transliteration (zh / en / ja / sv). The selected language is passed through the full stack, and each `(song, phoneticLang)` combination is cached independently in the database.

## Data Layer

### Schema change — `Lyrics` table

- Add `phoneticLang String` field (default `'zh'` for migration)
- Replace `@unique songId` with `@@unique([songId, phoneticLang])`
- No changes to `LyricLine` or `Segment` types — `phonetic` field is already language-agnostic strings

Migration steps:
1. Add `phoneticLang String @default("zh")` to `Lyrics` model
2. Change `@@unique` constraint
3. Update `Song` model: `lyrics Lyrics?` → `lyrics Lyrics[]` (one-to-many)
4. Run `prisma migrate dev`
5. Existing rows get `phoneticLang = 'zh'` automatically via default

## API

### `POST /api/songs`

Request body gains one new field:
```ts
phoneticLang: 'zh' | 'en' | 'ja' | 'sv'  // default 'zh'
```

The current API uses `include: { lyrics: true }` on the `Song` query (which returns `Lyrics?`). With the one-to-many change this becomes `Lyrics[]`. The API must change to:

1. Fetch song: `prisma.song.findUnique({ where: { youtubeId }, include: { lyrics: true } })`  
   → `existing.lyrics` is now `Lyrics[]`
2. Cache lookup: find the matching phonetic lang entry:
   ```ts
   const cachedLyrics = existing?.lyrics.find(l => l.phoneticLang === phoneticLang)
   ```
3. On create: `prisma.lyrics.create({ data: { songId, phoneticLang, lines: ... } })`

### `generatePhonetics` — system prompts per language

| `phoneticLang` | Prompt target |
|---|---|
| `zh` | 中文汉字音译（现有 prompt 不变） |
| `en` | IPA phonetic approximation in English letters |
| `ja` | カタカナ（katakana）phonetic reading |
| `sv` | Fonetisk approximation på svenska |

Function signature changes to:
```ts
generatePhonetics(language: string, phoneticLang: string, lines: ...)
```

## Frontend

### `src/app/page.tsx`

- New state: `const [phoneticLang, setPhoneticLang] = useState<PhoneticLang>('zh')`
- New selector section below `lang-filter`, same button group style:
  - 4 buttons: 中 / En / 日 / SV
  - Active button gets `active` class (same as song language buttons)
- `phoneticLang` passed in `POST /api/songs` body alongside existing fields

### `src/lib/i18n.ts`

Add to `Translations` interface and all 3 locale objects:
```ts
phoneticLangs: Record<string, string>
// zh: { zh: '中文', en: '英语', ja: '日语', sv: '瑞典语' }
// en: { zh: 'Chinese', en: 'English', ja: 'Japanese', sv: 'Swedish' }
// sv: { zh: 'Kinesiska', en: 'Engelska', ja: 'Japanska', sv: 'Svenska' }
```

`phoneticLanguageLabel` key already exists in all 3 locales — no change needed.

### `src/lib/types.ts`

Export phonetic language type:
```ts
export type PhoneticLang = 'zh' | 'en' | 'ja' | 'sv'
```

## Out of Scope

- Changing phonetic language on the song page after the song is loaded (phonetics are baked in at fetch time)
- Per-segment word-level language mixing
- Languages beyond zh / en / ja / sv
