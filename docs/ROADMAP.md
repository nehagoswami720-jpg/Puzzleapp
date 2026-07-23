# Roadmap

Five phases. **One at a time** — each stops at its acceptance criteria before the
next begins. The point of the ordering is that the mechanics work in isolation
before anything tries to generate them, so a bug in the pipeline can never be
confused with a bug in a puzzle.

| Phase | What | Status |
|---|---|---|
| 0 | Scaffold + `/dev` harness | ✅ Complete |
| 1 | Four mechanics working in isolation | ⬜ Next |
| 2 | Prompt → puzzles pipeline | ⬜ |
| 3 | Play polish, feedback, mobile + PWA | ⬜ |
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

## Phase 1 — Four mechanics ⬜

Implement Zip and Sequence (procedural) and Spot-the-Fallacy and Context-Cloze
(LLM), each with `generate()`, `grade()`, and a renderer, wired into `/dev`.

**Acceptance:** `/dev` can generate and play each mechanic at all three
difficulties; procedural instances are verified solvable; LLM instances are
schema-valid; grading is correct.

Planned work:

- `zip.ts` — lift `generateHamPath`, `placeCheckpoints`, `buildWalls`, and
  `generatePuzzle` from the verified prototype and wrap them in the `Mechanic`
  interface, adding the verify pass (solvable always; unique at medium/hard).
- `sequence.ts` — pick a rule (arithmetic, geometric, alternating,
  second-difference, Fibonacci-like) with seeded parameters, emit the terms, hide
  the tail. `SequenceInput` renderer.
- `lib/llm/client.ts` — the SDK wrapper, server-side only.
- `lib/llm/generateInstance.ts` — tool use to force structured JSON, Zod
  validation, retry ≤2, drop on failure.
- `spotTheFallacy.ts` and `contextCloze.ts` on top of it, both reusing
  `MultipleChoice`.
- `/dev` becomes a picker: mechanic × difficulty → generate → play → grade.

**The generation pipeline does not start until this phase passes.**

---

## Phase 2 — Prompt → puzzles pipeline ⬜

`interpret` + `select` + `generate`, and the chat input → option gallery → play
flow.

**Acceptance:** *"improve my vocabulary"* returns word puzzles; *"improve my
planning / logical reasoning"* returns Zip and sequences; each card shows what it
trains; the full loop works end to end.

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
