# Phonetic Language Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select their phonetic transliteration target language (zh/en/ja/sv) on the homepage, cache each (song, phoneticLang) combination independently.

**Architecture:** Add `phoneticLang` field to the `Lyrics` table with a composite unique key `(songId, phoneticLang)`, pass the selection through POST /api/songs, switch Claude prompts per language, and add a 4-button selector to the homepage UI.

**Tech Stack:** Next.js 16, Prisma v7 (SQLite), Claude API (`claude-sonnet-4-6`), TypeScript, React

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `phoneticLang` field, change `Lyrics` to one-to-many |
| `src/lib/types.ts` | Add `PhoneticLang` type export |
| `src/lib/i18n.ts` | Add `phoneticLangs` record to all 3 locales |
| `src/app/api/songs/route.ts` | Accept `phoneticLang`, per-lang prompts, fix cache lookup |
| `src/app/page.tsx` | Add phonetic language selector, pass `phoneticLang` in POST |

---

### Task 1: Prisma schema — add phoneticLang to Lyrics

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update schema.prisma**

Replace the entire `Lyrics` model and update the `Song` relation:

```prisma
model Song {
  id              String   @id @default(cuid())
  youtubeId       String   @unique
  title           String
  artist          String
  language        String
  thumbnailUrl    String
  durationSeconds Int
  createdAt       DateTime @default(now())
  lyrics          Lyrics[]
}

model Lyrics {
  id           String @id @default(cuid())
  songId       String
  phoneticLang String @default("zh")
  song         Song   @relation(fields: [songId], references: [id], onDelete: Cascade)
  lines        String

  @@unique([songId, phoneticLang])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-phonetic-lang
```

Expected output includes:
```
The following migration(s) have been applied:
  migrations/YYYYMMDD_add_phonetic_lang/migration.sql
```

Existing rows automatically get `phoneticLang = 'zh'` via the column default.

- [ ] **Step 3: Verify generated client compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (Prisma regenerates the client as part of `migrate dev`).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add phoneticLang to Lyrics table (composite unique key)"
```

---

### Task 2: Types + i18n

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add PhoneticLang to types.ts**

Add after the existing exports (after line 36):

```ts
export type PhoneticLang = 'zh' | 'en' | 'ja' | 'sv'
```

- [ ] **Step 2: Add phoneticLangs to i18n.ts Translations interface**

In `src/lib/i18n.ts`, add to the `Translations` interface (after `phoneticLanguageLabel`):

```ts
phoneticLangs: Record<string, string>
```

- [ ] **Step 3: Add phoneticLangs to all 3 locale objects**

In the `zh` locale object, add after `phoneticLanguageLabel`:
```ts
phoneticLangs: { zh: '中文', en: '英语', ja: '日语', sv: '瑞典语' },
```

In the `en` locale object, add after `phoneticLanguageLabel`:
```ts
phoneticLangs: { zh: 'Chinese', en: 'English', ja: 'Japanese', sv: 'Swedish' },
```

In the `sv` locale object, add after `phoneticLanguageLabel`:
```ts
phoneticLangs: { zh: 'Kinesiska', en: 'Engelska', ja: 'Japanska', sv: 'Svenska' },
```

- [ ] **Step 4: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/i18n.ts
git commit -m "feat: add PhoneticLang type and phoneticLangs i18n labels"
```

---

### Task 3: API — accept phoneticLang, per-language prompts, fix cache

**Files:**
- Modify: `src/app/api/songs/route.ts`

- [ ] **Step 1: Replace generatePhonetics with per-language prompt switching**

Replace the entire `generatePhonetics` function (lines 20–41) with:

```ts
const PHONETIC_PROMPTS: Record<string, string> = {
  zh: `你是一个专业的外语歌曲音译助手。将歌词转写为中国人能"按汉字发音来模拟演唱"的中文音译。
要求：①贴近原语言发音 ②自然流畅可唱 ③按词/短语分组返回 segments。
只返回合法 JSON 数组，不含其他任何文字或代码块标记。`,
  en: `You are a phonetic transcription assistant for foreign-language song lyrics. Transcribe each lyric line into approximate English phonetic spellings that an English speaker can use to sing along.
Rules: ① Stay close to the original pronunciation ② Natural to sing ③ Return word/phrase-level segments.
Return only a valid JSON array with no other text or code fences.`,
  ja: `あなたはプロの外国語歌詞音訳アシスタントです。歌詞の各行をカタカナで読み仮名（音訳）に変換してください。日本語話者がそのまま歌えるように、原語の発音に忠実なカタカナ表記を使ってください。
要件：①原語の発音に忠実 ②歌いやすい ③単語・フレーズ単位でsegmentsに分けて返す。
有効なJSON配列のみ返し、他のテキストやコードフェンスを含めないこと。`,
  sv: `Du är en professionell fonetisk transkriptionsassistent för utländska låttexter. Transkribera varje textrad till fonetiska stavningar på svenska som en svensktalande person kan använda för att sjunga med.
Regler: ① Håll dig nära originalets uttal ② Naturlig att sjunga ③ Returnera segment på ord-/frasnivå.
Returnera endast en giltig JSON-array utan annan text eller kodstängsel.`,
}

async function generatePhonetics(
  language: string,
  phoneticLang: string,
  lines: { index: number; text: string }[]
): Promise<{ index: number; phonetic: string; segments: { original: string; phonetic: string }[] }[]> {
  const systemPrompt = PHONETIC_PROMPTS[phoneticLang] ?? PHONETIC_PROMPTS.zh
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: JSON.stringify({ language, lines }),
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : null
  if (!text) throw new Error('Claude returned no text content')
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(clean)
}
```

- [ ] **Step 2: Update the POST handler body type and destructuring**

In the `POST` function, replace the `body` type and destructuring:

```ts
// Replace:
let body: { youtubeId: string; title: string; artist: string; language: string; thumbnailUrl: string; durationSeconds: number }

// With:
let body: { youtubeId: string; title: string; artist: string; language: string; phoneticLang?: string; thumbnailUrl: string; durationSeconds: number }
```

Replace the destructuring line:
```ts
// Replace:
const { youtubeId, title, artist, language, thumbnailUrl, durationSeconds } = body

// With:
const { youtubeId, title, artist, language, thumbnailUrl, durationSeconds } = body
const phoneticLang = body.phoneticLang ?? 'zh'
```

- [ ] **Step 3: Fix the cache lookup (Song now has lyrics[])**

Replace the existing cache block:

```ts
// Replace this block:
const existing = await prisma.song.findUnique({
    where: { youtubeId },
    include: { lyrics: true },
})
if (existing?.lyrics) {
    try {
        const lines = JSON.parse(existing.lyrics.lines) as LyricLine[]
        return NextResponse.json({ ...existing, createdAt: existing.createdAt.toISOString(), lines })
    } catch {
        // Corrupted cached data — fall through to re-generate
    }
}

// With:
const existing = await prisma.song.findUnique({
    where: { youtubeId },
    include: { lyrics: true },
})
const cachedLyrics = existing?.lyrics.find(l => l.phoneticLang === phoneticLang)
if (cachedLyrics) {
    try {
        const lines = JSON.parse(cachedLyrics.lines) as LyricLine[]
        return NextResponse.json({ ...existing, createdAt: existing!.createdAt.toISOString(), lines })
    } catch {
        // Corrupted cached data — fall through to re-generate
    }
}
```

- [ ] **Step 4: Add phoneticLang to the generatePhonetics call and lyrics.create**

Replace the `generatePhonetics` call:
```ts
// Replace:
phoneticData = await generatePhonetics(
    language,
    rawLines.map((line, i) => ({ index: i, text: line.text }))
)

// With:
phoneticData = await generatePhonetics(
    language,
    phoneticLang,
    rawLines.map((line, i) => ({ index: i, text: line.text }))
)
```

Replace the fallback `prisma.lyrics.create` (inside the catch block):
```ts
// Replace:
await prisma.lyrics.create({ data: { songId: song.id, lines: JSON.stringify(fallbackLines) } })

// With:
await prisma.lyrics.create({ data: { songId: song.id, phoneticLang, lines: JSON.stringify(fallbackLines) } })
```

Replace the final `prisma.lyrics.create` (at the end of the function):
```ts
// Replace:
await prisma.lyrics.create({ data: { songId: song.id, lines: JSON.stringify(lines) } })

// With:
await prisma.lyrics.create({ data: { songId: song.id, phoneticLang, lines: JSON.stringify(lines) } })
```

- [ ] **Step 5: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/songs/route.ts
git commit -m "feat: API accepts phoneticLang, per-language Claude prompts, composite cache lookup"
```

---

### Task 4: Fix GET /api/songs/[id] + song page navigation

**Files:**
- Modify: `src/app/api/songs/[id]/route.ts`
- Modify: `src/app/page.tsx` (navigation only)
- Modify: `src/app/song/[id]/page.tsx`

After the schema change, `song.lyrics` in `GET /api/songs/[id]` becomes `Lyrics[]` instead of `Lyrics | null`. The song page also needs to know which phonetic language was selected so it requests the right cached version.

- [ ] **Step 1: Fix GET /api/songs/[id] to accept phoneticLang query param**

Replace the entire `src/app/api/songs/[id]/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { LyricLine } from '@/lib/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const phoneticLang = req.nextUrl.searchParams.get('phoneticLang') ?? 'zh'

  let song
  try {
    song = await prisma.song.findUnique({
      where: { id },
      include: { lyrics: true },
    })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!song) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let lines: LyricLine[] = []
  const matchedLyrics = song.lyrics.find(l => l.phoneticLang === phoneticLang)
    ?? song.lyrics[0]
  if (matchedLyrics) {
    try {
      lines = JSON.parse(matchedLyrics.lines) as LyricLine[]
    } catch {
      lines = []
    }
  }

  return NextResponse.json({ ...song, createdAt: song.createdAt.toISOString(), lines })
}
```

Note: `?? song.lyrics[0]` is a graceful fallback — if the requested phoneticLang isn't cached yet, show whatever is available rather than blank lyrics.

- [ ] **Step 2: Update song page to read phonetic param and pass to fetch**

In `src/app/song/[id]/page.tsx`, add `useSearchParams` to the existing import:
```ts
import { useParams, useRouter, useSearchParams } from 'next/navigation'
```

Inside `SongPage`, after the existing hooks at the top, add:
```ts
const searchParams = useSearchParams()
const phoneticLang = searchParams.get('phonetic') ?? 'zh'
```

Then update the fetch call (in the `useEffect` that fetches the song):
```ts
// Replace:
fetch(`/api/songs/${id}`)

// With:
fetch(`/api/songs/${id}?phoneticLang=${phoneticLang}`)
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/songs/[id]/route.ts src/app/song/[id]/page.tsx
git commit -m "feat: GET /api/songs/[id] accepts phoneticLang query param, song page reads it"
```

---

### Task 5: Frontend — phonetic language selector on homepage

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add imports and constants**

At the top of `src/app/page.tsx`, add to the existing imports:
```ts
import type { PhoneticLang } from '@/lib/types'
```

After the existing `SONG_LANG_CODES` constant, add:
```ts
const PHONETIC_LANG_CODES: PhoneticLang[] = ['zh', 'en', 'ja', 'sv']
```

- [ ] **Step 2: Add phoneticLang state**

Inside `HomePage`, after the existing `const [language, setLanguage]` line, add:
```ts
const [phoneticLang, setPhoneticLang] = useState<PhoneticLang>('zh')
```

- [ ] **Step 3: Pass phoneticLang in the POST body**

In `handleSelect`, find the `body: JSON.stringify({...})` call and add `phoneticLang`:

```ts
body: JSON.stringify({
  youtubeId: result.videoId,
  title: result.title,
  artist: result.channelTitle,
  language: result.language,
  phoneticLang,
  thumbnailUrl: result.thumbnailUrl,
  durationSeconds: result.durationSeconds,
}),
```

- [ ] **Step 4: Update navigation to pass phoneticLang in URL**

In `handleSelect`, replace:
```ts
router.push(`/song/${song.id}`)
```
with:
```ts
router.push(`/song/${song.id}?phonetic=${phoneticLang}`)
```

- [ ] **Step 5: Add phonetic language selector to JSX**

In the `controls-card` section, add a second `lang-filter` div directly after the existing one (after the closing `</div>` of the song language filter):

```tsx
<div className="lang-filter">
  <span className="lang-label">{t.phoneticLanguageLabel}</span>
  <div className="lang-btns">
    {PHONETIC_LANG_CODES.map(code => (
      <button
        key={code}
        onClick={() => setPhoneticLang(code)}
        className={`lang-btn${phoneticLang === code ? ' active' : ''}`}
      >
        {t.phoneticLangs[code]}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 6: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run existing test suite**

```bash
npm test -- --passWithNoTests
```

Expected: 17/17 tests passing (lrc-parser: 7, LyricLine: 7, SearchBar: 3).

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: phonetic language selector on homepage (zh/en/ja/sv)"
```

---

### Task 6: Smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify homepage renders correctly**

Open `http://localhost:3000`. Confirm:
- Two language selectors visible: "歌曲语言" and "音译语言" (or localised equivalent)
- Phonetic language buttons: 中文 / 英语 / 日语 / 瑞典语 (in zh UI)
- Active button highlights on click

- [ ] **Step 3: Test cache across phonetic languages**

1. Select song language = English, phonetic language = 中文, search and load a song
2. Confirm Chinese phonetics appear below lyrics
3. Go back, select same song with phonetic language = 日, load again
4. Confirm katakana phonetics appear (new generation ~10-30s wait)
5. Go back and reload the 中文 version — should be instant (cached)

- [ ] **Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: smoke test corrections"
```
