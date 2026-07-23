# Skill-Based Puzzle Generator — Build Spec (for Claude Code)

*Status: Build-ready v1 · Type: 0→1 webapp · Audience: the engineer/agent building this*

This is an implementation spec, not a market doc. Build it in the phased order in §16 and treat each phase's **Acceptance** as the definition of done before moving on.

---

## 1. What we're building

A webapp where a user types a skill they want to improve — e.g. *"I want to improve my critical thinking"* or *"improve my vocabulary"* — and the app generates a few (3–4) tailored, self-contained **puzzles/challenges** to practice it. The user picks one, plays it inline, gets instant grading plus an explanation, and can request another or a harder one.

## 2. Hard scope boundaries (do not violate)

- **Puzzles and challenges only — NOT full games.** No game engines, levels, physics, sprites, narrative, timers-as-gameplay, or persistent game worlds. Each output is a single, self-contained exercise that a user completes in under ~2 minutes and that has a checkable answer (or a rubric-gradable response).
- **Everything is generated from the user's prompt.** The user's free-text skill request drives which puzzles appear and their content. No fixed daily catalog.
- **Every puzzle must be verifiably correct and solvable before it reaches the user.** A broken/unsolvable puzzle is the #1 failure mode; the architecture below exists to prevent it.

## 3. Core loop

```
user types skill  →  interpret skill  →  select 3–4 mechanics  →
generate an instance of each  →  show option cards  →  user picks one  →
play  →  grade + explain  →  {try another | make it harder | new skill}
```

## 4. Architecture: two generation engines + a mechanic library

The core idea: **the app owns the rules, rendering, and grading; the generator only supplies content.** Never let an LLM invent a whole puzzle freeform.

There are **two engines**, and each mechanic declares which one it uses:

- **Engine A — Procedural (code).** For structured logic/spatial/numeric puzzles with no semantic content: Zip, sequences, sudoku, nonograms, mazes, mental math, memory. Pure TypeScript generators. Deterministic, always solvable, ~zero cost, no LLM. **Zip lives here.**
- **Engine B — LLM content-fill.** For language/knowledge/reasoning puzzles whose *content* carries meaning: vocabulary, fallacies, assumptions, analogies, categorization. The LLM returns **structured JSON that fills a fixed schema** — never prose describing a game. Output is schema-validated (Zod) and regenerated on failure.

Both engines produce the same `PuzzleInstance` object and plug into the same **Mechanic Library** (§9), so the rest of the app is engine-agnostic.

### How a puzzle maps to a skill

- **Content-matched mechanics** (most LLM ones) are tailored by content — a fallacy puzzle *is about* critical thinking.
- **Cognitive-matched mechanics** (most procedural ones, incl. Zip) are tailored by the mental faculty they exercise, not the topic. Zip trains planning/sequential/spatial reasoning, so it surfaces for "planning" or "logical reasoning," **not** "vocabulary." Every card must display a `trainsLabel` so the match reads as intentional.

## 5. In scope (MVP) / Out of scope (MVP)

**In:** chat input; skill interpretation; mechanic selection; 4 mechanics at launch growing to ~15; procedural + LLM generation; inline play; deterministic + LLM-judge grading; explanations; difficulty (easy/med/hard); "another/harder/new skill"; optional localStorage progress; **mobile-first responsive UI**; **installable as a PWA** (add-to-home-screen, works fullscreen on a phone).

**Out (defer):** accounts/auth, server database, cloud sync, multiplayer/social, streaks/daily sets, spaced repetition, mobile-native, monetization. Keep MVP client-heavy with a thin API layer.

## 6. Tech stack

- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **Anthropic API** via the official TypeScript SDK (`@anthropic-ai/sdk`), using **tool use to force structured JSON output**. Use a current, fast Claude model — confirm the latest model string from the API docs map (https://docs.claude.com/en/docs_site_map.md) rather than hardcoding a stale one. **All Anthropic calls run server-side in API routes; the API key lives in an env var and is never shipped to the client.**
- **Zod** for schema validation of all generated content (both engines).
- **Procedural generators**: pure TS, seedable RNG (e.g. a small seeded PRNG), generate-then-verify.
- **State/persistence (MVP)**: React state; optional `localStorage` for progress. No DB.
- **Env**: `ANTHROPIC_API_KEY`.

## 7. Suggested project structure

```
/app
  /page.tsx                 # chat home + gallery + play (or split routes)
  /dev/page.tsx             # dev harness: instantiate & play any mechanic
  /api/interpret/route.ts   # prompt -> SkillContext
  /api/generate/route.ts    # SkillContext (or prompt) -> PuzzleInstance[]
  /api/grade/route.ts       # instance + answer -> GradeResult (LLM-judged/open only)
/lib
  /mechanics/
    index.ts                # registry: id -> Mechanic
    types.ts                # Mechanic, PuzzleInstance, SkillContext, GradeResult
    subskills.ts            # controlled sub-skill tag vocabulary
    zip.ts                  # procedural
    sequence.ts             # procedural
    spotTheFallacy.ts       # llm
    contextCloze.ts         # llm
    ...                     # remaining mechanics
  /llm/
    client.ts               # Anthropic SDK wrapper
    generateInstance.ts     # LLM content-fill + Zod validate + retry
    judge.ts                # LLM-as-judge for open answers
  /select.ts                # skill subSkills -> ranked mechanics
  /rng.ts                   # seeded PRNG
/components
  ChatInput.tsx
  OptionGallery.tsx  OptionCard.tsx
  PlayShell.tsx  FeedbackPanel.tsx
  /renderers/
    ZipBoard.tsx
    SequenceInput.tsx
    MultipleChoice.tsx      # reused by fallacy/assumption/cloze/analogy/odd-one-out
    MatchPairs.tsx  GridInput.tsx  ...
```

## 8. Data models (TypeScript)

```ts
type Difficulty = 'easy' | 'medium' | 'hard';
type Engine = 'procedural' | 'llm';
type MatchMode = 'content' | 'cognitive';
type AnswerType = 'exact' | 'set' | 'range' | 'path' | 'grid' | 'open';

interface SkillContext {
  rawPrompt: string;
  canonicalSkill: string;      // e.g. "Critical Thinking"
  subSkills: string[];         // from the controlled vocab in subskills.ts
  domain: 'reasoning' | 'language' | 'numeracy' | 'memory' | 'spatial' | 'knowledge' | 'other';
  needsClarification: boolean;
  clarifyingQuestion?: string; // asked in chat when the prompt is too vague
}

interface PuzzleInstance<Content = unknown, Solution = unknown> {
  id: string;
  mechanicId: string;
  skillContext: SkillContext;
  subSkillsTrained: string[];
  difficulty: Difficulty;
  title: string;               // card title, e.g. "Spot the Fallacy"
  trainsLabel: string;         // e.g. "Trains: spotting hidden assumptions"
  prompt: string;              // instructions shown to the user
  content: Content;            // mechanic-specific, schema-validated
  solution: Solution;          // grade against this
  explanation: string;         // shown after grading
  engine: Engine;
}

interface GradeResult {
  correct: boolean;
  score?: number;              // 0..1 for open/rubric grading
  feedback: string;            // short, encouraging, specific
  explanation: string;         // the teaching moment
  revealedSolution?: unknown;
}

// The common contract every mechanic module implements:
interface Mechanic<Content = unknown, Answer = unknown, Solution = unknown> {
  id: string;
  name: string;
  description: string;
  subSkills: string[];         // tags used for selection
  engine: Engine;
  matchMode: MatchMode;
  answerType: AnswerType;
  difficulties: Difficulty[];
  generate(args: { skill: SkillContext; difficulty: Difficulty; seed?: number })
    : Promise<PuzzleInstance<Content, Solution>>;
  grade(instance: PuzzleInstance<Content, Solution>, answer: Answer)
    : Promise<GradeResult>;
  // React renderer is registered separately by mechanic id
}
```

**Sub-skill tag vocabulary** (`subskills.ts`) — mechanics and the interpreter share this exact set so selection works:
`deductive-reasoning, inductive-reasoning, assumption-identification, fallacy-detection, argument-evaluation, logical-consistency, planning, sequential-reasoning, systematic-search, spatial-reasoning, visual-pattern, pattern-recognition, abstract-reasoning, analogical-reasoning, vocabulary, word-meaning, semantic-relations, verbal-fluency, mental-arithmetic, estimation, numerical-pattern, working-memory, recall, categorization, general-knowledge`.

## 9. The Mechanic Library

Each mechanic is a self-contained module implementing the `Mechanic` interface + a registered renderer. Below are the four MVP mechanics fully specified, then the target library.

### 9.1 Zip — procedural (Engine A)

- **subSkills:** `planning, sequential-reasoning, spatial-reasoning, systematic-search` · **matchMode:** cognitive · **answerType:** path
- **Rules (app-enforced):** single continuous path; start at 1; hit numbered checkpoints in ascending order; visit every cell exactly once; orthogonal moves only; never cross a wall segment.
- **Content schema:**
  ```ts
  { rows: number; cols: number;
    checkpoints: { n: number; row: number; col: number }[]; // n = 1..k
    walls: { between: [ [r,c], [r,c] ] }[] }                 // blocked edges
  ```
- **Solution:** ordered list of `[row,col]` cells (the Hamiltonian path).
- **Generator:** (1) generate a random Hamiltonian path over the grid with seeded RNG; (2) place checkpoints on a subset of path cells in path order (endpoints first: 1 at start, k at end); (3) optionally add walls consistent with the path; (4) **verify** with a solver that a valid solution exists and, for medium/hard, that it's unique — regenerate if not. Difficulty → grid size (easy 5×5, medium 6×6, hard 7×7) and wall/checkpoint density.
- **Grade:** deterministic — check the submitted path satisfies all four rules.
- **Renderer:** `ZipBoard` (drag/tap to draw, backtrack, undo).

### 9.2 Sequence — procedural (Engine A)

- **subSkills:** `pattern-recognition, numerical-pattern, abstract-reasoning` · cognitive · exact
- **Content:** `{ terms: number[]; blanks: number[] }` (show terms, hide the last 1–2).
- **Solution:** the hidden term(s). **Generator:** pick a rule (arithmetic, geometric, alternating, second-difference, Fibonacci-like) with seeded params; emit terms; hide the tail. Difficulty → rule complexity. **Grade:** exact match. **Renderer:** `SequenceInput`.

### 9.3 Spot the Fallacy — LLM (Engine B)

- **subSkills:** `fallacy-detection, argument-evaluation` · content · exact (multiple choice)
- **Content schema (LLM must return exactly this):**
  ```ts
  { argument: string;                 // 1–3 sentence everyday argument containing one fallacy
    options: string[];                // 4 fallacy names, one correct
    correctIndex: number;
    explanation: string }             // why it's that fallacy
  ```
- **Prompt template (sketch):** "Produce a short everyday argument that commits exactly one logical fallacy relevant to `{canonicalSkill}`. Return ONLY JSON matching the schema. Difficulty `{difficulty}` controls how subtle the fallacy is. Options must be plausible and mutually exclusive; exactly one correct." Validate with Zod; retry ≤2; drop on failure.
- **Grade:** deterministic exact-index match; show `explanation`. **Renderer:** `MultipleChoice`.

### 9.4 Context Cloze — LLM (Engine B)

- **subSkills:** `vocabulary, word-meaning` · content · exact (multiple choice)
- **Content schema:**
  ```ts
  { sentence: string;      // contains a single "____" blank
    options: string[];     // 4 words, one best fit
    correctIndex: number;
    targetWord: string;
    explanation: string }
  ```
- **Prompt template (sketch):** "Write a natural sentence with one blank that has a single best-fitting word appropriate to a `{difficulty}` vocabulary level. Provide 3 plausible distractors (near-misses at higher difficulty). Return ONLY JSON." Validate/retry as above. **Grade:** exact-index. **Renderer:** `MultipleChoice`.

### 9.5 Target library (build in Phase 4 after the four above)

| Mechanic | Engine | Key subSkills | Renderer |
|---|---|---|---|
| Zip | procedural | planning, spatial | ZipBoard |
| Sequence | procedural | pattern, numerical-pattern | SequenceInput |
| Mini-Sudoku | procedural | logical-consistency, systematic-search | GridInput |
| Nonogram (small) | procedural | spatial, deductive | GridPaint |
| Maze / shortest path | procedural | spatial, planning | MazeBoard |
| Mental Math sprint | procedural | mental-arithmetic | NumberInput |
| Matching Pairs | procedural | working-memory, recall | MemoryGrid |
| Spot the Fallacy | llm | fallacy-detection | MultipleChoice |
| Hidden Assumption | llm | assumption-identification | MultipleChoice |
| What Follows (deduction) | llm | deductive-reasoning | MultipleChoice |
| Context Cloze | llm | vocabulary | MultipleChoice |
| Synonym/Antonym Match | llm | semantic-relations | MatchPairs |
| Odd One Out (semantic) | llm | semantic-relations, categorization | MultipleChoice |
| Verbal Analogy | llm | analogical-reasoning | MultipleChoice |
| Category Guess (Pinpoint-style) | llm | categorization, general-knowledge | GuessInput |

Note: one `MultipleChoice` renderer serves ~6 LLM mechanics — build it well and reuse it.

## 10. Generation pipeline (prompt → puzzles)

1. **`POST /api/interpret { prompt }` → `SkillContext`.** One LLM call maps the free text to a canonical skill, a subset of the sub-skill vocabulary, a domain, and `needsClarification` (+ a `clarifyingQuestion` if the prompt is too vague to pick sub-skills, e.g. "improve at games").
2. **`select(skillContext)` → 3–4 mechanics — the LLM decides, from the fixed catalog.** Pass the mechanic catalog (each id + `name` + `description` + `subSkills` + `engine`) to the model and have it choose the 3–4 that best fit the interpreted skill, enforcing variety (don't return four multiple-choice puzzles) and at least one easier win. This is what makes the app feel like "the LLM picks the right puzzle for my prompt." **Invariant: the LLM only ever chooses from and fills the existing catalog — it never invents a new game type.** Steps 1 and 2 can be one combined planner call. Keep a deterministic tag-overlap scorer as a cheap fallback if a model call fails or for offline testing.
3. **For each selected mechanic → `generate()`.** Procedural runs the TS generator; LLM calls `generateInstance` (structured output + Zod validate + retry ≤2). If a mechanic can't produce a valid instance, silently fall through to the next-ranked one so the user always gets a full set.
4. Return `PuzzleInstance[]` as option cards.

For MVP you may combine 1–4 into a single `POST /api/generate { prompt }` → `{ skillContext, instances }`.

## 11. Grading

- **Deterministic mechanics** (`exact`, `set`, `range`, `path`, `grid`): grade client-side or in `grade()`; ship `solution` to the client only for these where spoiling isn't a concern.
- **Open mechanics** (`open`): grade server-side via `POST /api/grade` using an **LLM-as-judge with an explicit rubric**, returning a 0–1 `score` + feedback. Keep `solution`/rubric server-side for these.
- Always return an `explanation` — that's the learning payload.

## 12. UI / screens

1. **Home / chat:** input box + 3 seeded example prompts ("critical thinking," "vocabulary," "mental math"). Submit → skeleton cards while generating.
2. **Option gallery:** 3–4 `OptionCard`s (title, `trainsLabel`, difficulty pill, Play).
3. **Play surface (`PlayShell`):** renders the mechanic component; Submit → `FeedbackPanel` (correct/incorrect, `feedback`, `explanation`, "why this helps"); actions: **Try another · Make it harder · New skill**.
4. **Clarify state:** if `needsClarification`, show the `clarifyingQuestion` as a chat bubble before generating.
5. **Broken-puzzle report:** small thumbs-down on the play surface → logs `{instanceId, reason}` (quality signal for later).

## 13. Difficulty model

`easy | medium | hard`, passed into `generate()`. Each mechanic maps it to its own params (Zip grid size; cloze word rarity + distractor closeness; fallacy subtlety; sequence rule depth). "Make it harder" re-generates the same mechanic one level up.

## 14. Quality guardrails (non-negotiable)

- LLM output **must** pass Zod validation; retry ≤2; on failure drop the mechanic, never show malformed content.
- Procedural output **must** pass generate-then-verify (solver confirms solvability, and uniqueness at medium/hard).
- No puzzle reaches the user without passing its engine's check.
- Light content filter on LLM output so generated text stays appropriate.

## 15. Config / env

- `ANTHROPIC_API_KEY` (required).
- Model string in one config constant (confirm current model from docs; prefer a fast model for latency/cost).
- Optional `SEED` for reproducible procedural generation in tests.

## 16. Build order & acceptance criteria

**Phase 0 — Scaffold.** Next.js + TS + Tailwind + SDK + Zod; types + empty registry; a `/dev` page rendering one hardcoded Zip and one hardcoded MultipleChoice instance.
✅ *Accept:* both hardcoded puzzles render and grade correctly.

**Phase 1 — Four mechanics.** Implement Zip + Sequence (procedural) and Spot-the-Fallacy + Context-Cloze (LLM), each with `generate()`, `grade()`, and a renderer, wired into `/dev`.
✅ *Accept:* `/dev` can generate and play each mechanic at all difficulties; procedural instances verified solvable; LLM instances schema-valid; grading correct.

**Phase 2 — Prompt→puzzles pipeline.** `interpret` + `select` (with sub-skill vocab) + `generate`; chat input → option gallery → play.
✅ *Accept:* "improve my vocabulary" returns word puzzles; "improve my planning / logical reasoning" returns Zip/sequence; each card shows what it trains; full loop works end-to-end.

**Phase 3 — Play polish, feedback & mobile/PWA.** `FeedbackPanel` with explanation + why-it-helps; Try another / Make it harder / New skill; clarifying-question flow; broken-puzzle thumbs. Make the whole UI mobile-first (touch targets, drag works on touch) and add the PWA layer (§18) so it installs to a phone home screen.
✅ *Accept:* loop feels smooth; a vague prompt triggers exactly one clarifying question; "harder" raises difficulty; the deployed URL installs to an iPhone home screen and runs fullscreen; every mechanic is playable by touch.

**Phase 4 — Expand & persist.** Grow to the ~15-mechanic library (§9.5); add `localStorage` progress per sub-skill; optional adaptive difficulty.
✅ *Accept:* ≥12 mechanics live; broad skill coverage; progress survives reload.

## 17. Explicit non-goals (repeat)

No full games, levels, physics, narrative, or game loops. No accounts, server DB, multiplayer, or monetization in MVP. Puzzles/challenges only, generated from the user's prompt, always verified before display.

## 18. Deployment & phone install (PWA)

The app must be usable on a phone by adding it to the home screen — no app store, no native build.

- **Mobile-first:** design for a ~380px viewport first; large touch targets; puzzle boards scale to width; drawing/answering works by touch (the Zip board already supports pointer + touch drag).
- **PWA layer:** add a `manifest.webmanifest` (`name`, `short_name`, `display: "standalone"`, `theme_color`, `background_color`, and 192px + 512px icons) and register a minimal service worker that caches the app shell so it launches fullscreen and opens instantly. For iOS, include `apple-touch-icon` and the `apple-mobile-web-app-capable` / status-bar meta tags so "Add to Home Screen" gives a fullscreen, chromeless launch.
- **Deploy:** host on **Vercel** (native Next.js support, free tier). Set `ANTHROPIC_API_KEY` as a Vercel environment variable. All model calls stay in server-side API routes, so the key never reaches the phone.
- **Install flow (for the owner):** open the Vercel URL in mobile Safari/Chrome → Share → Add to Home Screen → launches like an app.
- **Note:** a service worker can cache the static shell for instant load, but puzzle generation still needs the network (LLM calls + serverless). Full offline play is out of scope for MVP; procedural mechanics like Zip *could* run offline later since they need no network.
