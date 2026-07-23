# Roadmap

Five phases. **One at a time** — each stops at its acceptance criteria before the
next begins. The point of the ordering is that the mechanics work in isolation
before anything tries to generate them, so a bug in the pipeline can never be
confused with a bug in a puzzle.

| Phase | What | Status |
|---|---|---|
| 0 | Scaffold + `/dev` harness | ✅ Complete |
| 1 | Four mechanics working in isolation | ✅ Complete |
| 2 | Prompt → puzzles pipeline | ✅ Complete |
| 3 | Play polish, feedback, mobile + PWA | ⬜ Next |
| 4 | Expand the library, persist progress | ⬜ |

---

## Phase 0 — Scaffold ✅

Next.js + TypeScript + Tailwind + `@anthropic-ai/sdk` + Zod; the type system and
an empty registry; a `/dev` page rendering one hardcoded Zip and one hardcoded
multiple-choice instance.

**Acceptance:** both hardcoded puzzles render and grade correctly. ✔

### What was built

| Area | Detail |
|---|---|
| Config | `lib/config.ts` pins the model in one constant and reads `ANTHROPIC_API_KEY` server-side only, throwing rather than constructing a keyless client. `SEED` support for reproducible tests. |
| Types | `Mechanic`, `PuzzleInstance`, `SkillContext`, `GradeResult`, plus `CatalogEntry` — the trimmed catalog view the planner sees, so it can only pick an existing id. |
| Vocabulary | All 25 sub-skill tags as a union type, with `coerceSubSkills()` to drop anything a model invents, and `trainsLabel()` for card copy. |
| Registry | `register` / `getMechanic` / `allMechanics` / `catalog`. Deliberately empty — Phase 1 fills it. |
| Zip | Content and solution shapes, `checkZipPath` enforcing the four rules, `canEnter` for legality while drawing, `gradeZipPath`. |
| Multiple choice | Shared content/answer types and `gradeMultipleChoice`, ready for the ~6 mechanics that reuse them. |
| Renderers | `ZipBoard` (pointer + touch drag, drag-back to backtrack, arrow keys and Backspace, scales to viewport width) and `MultipleChoice` (≥44px targets, radio semantics). |
| Harness | `PlayCard` — renderer + Submit + feedback — and `/dev` showing both fixtures. |

### Verification

- `next build`, `tsc --noEmit`, and `eslint` all clean.
- The Zip fixture's stored solution passes all four rules; **no wall sits on an
  edge the solution uses**; checkpoints ascend along the path.
- Drawing the solution step by step is legal at every move; wall crossings and
  out-of-order checkpoints are refused mid-draw.
- Grading rejects short, revisiting, and non-adjacent paths with the right
  reason; multiple choice grades both ways.

### Decisions worth remembering

- **Answer keys stay out of `content`.** The LLM returns the spec's full schema,
  but the mechanic splits `correctIndex` and `explanation` onto
  `PuzzleInstance.solution` / `.explanation`, so client-visible content carries
  no answer key.
- **`gradeZipPath` checks the rules, not the stored solution**, so any valid
  Hamiltonian path is accepted.
- **Renderers dispatch via a `switch`, not an `id → component` map** — a
  component looked up during render remounts when the lookup identity changes,
  discarding a half-drawn puzzle.
- **`ZipBoard` has no reset effect**; `PlayCard` mounts it keyed on the instance
  id, so a new puzzle gets a fresh board.

### Not yet verified

Real touch-drag on a physical device. The pointer logic is verified through
`canEnter` rather than by actually dragging. Covered by Phase 3's acceptance.

---

## Phase 1 — Four mechanics ✅

Zip and Sequence (procedural) plus Spot-the-Fallacy and Context-Cloze (LLM),
each with `generate()`, `grade()`, and a renderer, wired into `/dev`.

**Acceptance:** `/dev` can generate and play each mechanic at all three
difficulties; procedural instances are verified solvable; LLM instances are
schema-valid; grading is correct. ✔

### What was built

| Area | Detail |
|---|---|
| Zip | The prototype's `generateHamPath` / `snakePath` / `placeCheckpoints` / `buildWalls` ported unchanged, plus a bounded solver and a generate-then-verify loop that escalates wall density until the solution is unique. |
| Sequence | Five rule families (arithmetic, geometric, alternating, quadratic, Fibonacci-like) with an *ambiguity* verifier — every candidate is re-fitted with every family, and rejected if another family fits the visible terms but predicts a different continuation. |
| LLM layer | `client.ts` (server-only, with a runtime guard) and `generateInstance.ts` — forced tool use, Zod validation, retry ≤2 with the validation error fed back, then `ContentFillError` so the caller drops the mechanic. Light content screen on generated text. |
| Fallacy / Cloze | Both fill the §9.3/§9.4 schemas and reuse `MultipleChoice`. Cloze adds cross-field refinements: exactly one blank, `options[correctIndex] === targetWord`, four distinct options. |
| Boundary | `procedural.ts` (client-safe) vs `server.ts` (registers all four, pulls in `lib/llm`). API routes `/api/dev/catalog` and `/api/dev/generate`. |
| Harness | `/dev` is now mechanic × difficulty × prompt → generate → play → grade. Procedural generates in the browser; LLM goes through the API. |

### Verification

**Zip**, 40 boards per difficulty:

| | solvable | unique | wall conflicts | checkpoint order | speed |
|---|---|---|---|---|---|
| easy | 40/40 | 19/40 *(not required)* | 0 | 0 bad | 5ms |
| medium | 40/40 | **40/40** | 0 | 0 bad | 1ms |
| hard | 40/40 | **40/40** | 0 | 0 bad | 26ms |

**Sequence**, 200 per difficulty: 0 ambiguous out of 600, 0 malformed, no
fallbacks needed, all five rule families exercised. Both generators are
deterministic from a seed.

**LLM**, 18 live generations (2 mechanics × 3 difficulties × 3): 18/18
schema-valid, correct grading both ways, no answer key in client-visible
content, 5–7s each. Seven deliberately malformed payloads were all rejected by
the schemas.

**Boundary:** 14 client chunks scanned — zero occurrences of `sk-ant`,
`ANTHROPIC_API_KEY`, `anthropic-ai`, or the generation prompts.

### Known gaps, carried into Phase 2

- **Multiple-choice answers still ship to the client.** `/api/dev/generate`
  returns the whole instance including `solution` so the harness can grade
  locally. Phase 2 should strip `solution` for content-matched mechanics and
  grade them through `/api/grade`.
- **Latency is the hosting risk.** ~6s per LLM mechanic means a serial Phase 2
  fan-out of three would approach the function limit. Generate in parallel.
- **Zip uniqueness at easy is incidental** (19/40) — by design, `requireUnique`
  is off there.

---

## Phase 2 — Prompt → puzzles pipeline ✅

`interpret` + `select` + `generate` behind one `/api/generate` call, and the
chat input → option gallery → play loop on the home page.

**Acceptance:** *"improve my vocabulary"* returns word puzzles; *"improve my
planning / logical reasoning"* returns Zip and sequences; each card shows what it
trains; the full loop works end to end. ✔

### What was built

| Area | Detail |
|---|---|
| Planner | One model call interpreting the skill **and** selecting mechanics (§10 permits combining them; one round trip is the difference between a comfortable wait and a timeout). The `mechanicId` field is a Zod enum built from the live catalog, so the core invariant — the LLM can't invent a game type — is enforced *structurally*, not by instruction. |
| Selector | `rankMechanics` (deterministic tag-overlap, the no-model fallback) and `enforceVariety` (§10's two rules, applied to whatever produced the shortlist). Variety is measured by `answerType` — two puzzles answered the same way are the same interaction twice, whatever their subject. |
| Pipeline | `promptToPuzzles`: plan, then generate in **parallel**. `Promise.allSettled` gives §10's fall-through free — a failed mechanic is dropped and a next-ranked one generated in its place. One round of backfill only. |
| API | `POST /api/generate { prompt }` → `{ skillContext, instances, diagnostics }`, `maxDuration` 90. |
| UI | `ChatInput` (three seeded prompts), `OptionGallery` + `SkeletonCards`, and a home page that runs home → loading → gallery → play, with a clarify bubble and a *New skill* reset. |

### Verification

Routing, three acceptance prompts, planner succeeding (no fallback):

| Prompt | Set (lead card first) |
|---|---|
| improve my vocabulary | **context-cloze** (easy) · zip · sequence |
| improve my planning | **zip** (easy) · sequence · spot-the-fallacy |
| improve my logical reasoning | **spot-the-fallacy** (easy) · sequence · zip |

The content-matched mechanic leads and is the easy win every time. End-to-end
~10–19s, no drops, no answer-key leak in `content`. The selector was unit-tested
with no model in the loop: correct leads, the answer-type variety cap holding,
and a hallucinated `chess` id dropped and backfilled to three. Client bundle:
12 chunks, zero occurrences of the SDK, the key, or the planner prompt.

### A bug worth remembering

The planner first fell back on two of three prompts. Cause: when the model chose
to clarify, it wrote a question over the 200-char cap **and** returned fewer than
three selections — both violated the schema, so it burned every retry and
dropped to the tag-overlap fallback on exactly the inputs the planner handles
best. The silent `catch` hid it. Fix: log the fallback reason, log validation
failures (each retry is a full round trip, so a recurring one is a latency bug,
not just a quality one), raise the question cap, and floor `selections` at 0 —
`enforceVariety` guarantees ≥3 for the play path, and the clarify path returns
before generation, so a short list there is harmless.

### Decisions and known gaps, carried into Phase 3

- **Exact multiple-choice grades client-side, by design.** §11 permits shipping
  the solution for `exact`/`path`/`grid` answer types where spoiling isn't a
  concern. With no score, streak, or leaderboard in MVP, a peekable answer only
  affects the learner. `/api/grade` lands in Phase 4 with the first `open`
  rubric mechanic, which genuinely needs server-side judging.
- **The clarify flow is wired but rarely fires.** At `effort: low` the planner
  is decisive enough to route even "get smarter" rather than ask. Phase 3's
  acceptance ("a vague prompt triggers exactly one clarifying question") will
  need prompt tuning to make it fire when it should.
- **Small-catalog padding.** With four mechanics, a set of 3–4 always uses most
  of the catalog, so vocabulary gets a Zip alongside the cloze. The matched
  mechanic always leads; the padding resolves in Phase 4 when word-matched
  mechanics (synonym match, odd-one-out, analogy) exist.
- **Latency is the deploy risk, now measured** at ~10–19s. Parallel generation
  keeps it under the function limit; a bigger catalog or a slower planner would
  make streaming the cards in worthwhile.

---

## Phase 3 — Play polish, feedback, mobile + PWA ⬜

The real feedback panel with explanation and why-it-helps; *try another* /
*make it harder* / *new skill*; the clarifying-question flow; the broken-puzzle
thumbs-down. The whole UI goes mobile-first, and the PWA layer lands.

**Acceptance:** the loop feels smooth; a vague prompt triggers exactly one
clarifying question; *harder* raises difficulty; the deployed URL installs to an
iPhone home screen and runs fullscreen; every mechanic is playable by touch.

---

## Phase 4 — Expand and persist ⬜

Grow to the ~15-mechanic library: Mini-Sudoku, Nonogram, Maze, Mental Math,
Matching Pairs, Hidden Assumption, What Follows, Synonym/Antonym Match, Odd One
Out, Verbal Analogy, Category Guess. Add `localStorage` progress per sub-skill
and optional adaptive difficulty.

**Acceptance:** ≥12 mechanics live; broad skill coverage; progress survives a
reload.
