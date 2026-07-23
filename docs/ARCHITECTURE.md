# Architecture

*How the pieces fit and which properties must hold. For the product-level view
see [`PRD.md`](PRD.md); for what's built when see [`ROADMAP.md`](ROADMAP.md).*

---

## The governing idea

**The app owns the rules, rendering, and grading. The generator only supplies
content.**

An LLM is never asked to produce a whole puzzle freeform. Every puzzle is an
instance of a mechanic that already exists in code, with a renderer that already
exists, graded by rules that already exist. The model's entire job is choosing
which mechanics fit a request and filling their schemas.

## Invariants

These are the properties everything else is arranged to protect. If a change
breaks one of these, it's the wrong change.

1. **The LLM only chooses from and fills the fixed catalog.** It never invents a
   new game type. The planner is handed a trimmed catalog view (`CatalogEntry`:
   id, name, description, sub-skills, engine) and must return ids from it.
2. **No puzzle reaches the user without passing its engine's check.** Zod for
   LLM output, generate-then-verify for procedural.
3. **The API key never reaches the client.** All Anthropic calls happen in
   server-side API routes.
4. **Correctness is decided by rules, not by matching a stored solution.** Zip
   accepts *any* valid Hamiltonian path, not only the generated one.
5. **Answer keys stay out of client-visible content.** See
   [Where the answer lives](#where-the-answer-lives).

## Two engines

Each mechanic declares which engine it uses. Both produce the same
`PuzzleInstance`, so selection, rendering, grading, and the UI are all
engine-agnostic.

**Engine A — Procedural (code).** Structured logic, spatial, and numeric puzzles
with no semantic content: Zip, sequences, sudoku, nonograms, mazes, mental math,
memory. Pure TypeScript with a seeded PRNG. Deterministic, always solvable,
~zero cost, no network.

**Engine B — LLM content-fill.** Language, knowledge, and reasoning puzzles whose
*content* carries meaning: vocabulary, fallacies, assumptions, analogies,
categorisation. The model returns structured JSON filling a fixed schema — never
prose describing a game. Validated with Zod, regenerated on failure.

## How a puzzle matches a skill

Two different mechanisms, and the distinction matters for selection:

- **Content-matched** (most LLM mechanics) — tailored by subject. A fallacy
  puzzle *is about* critical thinking.
- **Cognitive-matched** (most procedural mechanics, including Zip) — tailored by
  the mental faculty exercised, not the topic. Zip trains planning, sequential
  and spatial reasoning, so it surfaces for "planning" or "logical reasoning" and
  never for "vocabulary".

Because a cognitive match is less self-evident to the user, every card must
display a `trainsLabel` so the choice reads as intentional.

## Data models

```ts
type Difficulty = 'easy' | 'medium' | 'hard';
type Engine     = 'procedural' | 'llm';
type MatchMode  = 'content' | 'cognitive';
type AnswerType = 'exact' | 'set' | 'range' | 'path' | 'grid' | 'open';
```

**`SkillContext`** — the interpreted request: the raw prompt, a canonical skill
name, sub-skills drawn from the controlled vocabulary, a domain, and whether
clarification is needed.

**`PuzzleInstance<Content, Solution>`** — one playable puzzle: identity, the
mechanic that made it, the skill context, difficulty, card copy (`title`,
`trainsLabel`, `prompt`), the mechanic-specific validated `content`, the
`solution` to grade against, and the `explanation` shown afterwards.

**`GradeResult`** — `correct`, an optional 0–1 `score` for rubric grading, short
specific `feedback`, the teaching-moment `explanation`, and optionally the
revealed solution.

**`Mechanic<Content, Answer, Solution>`** — the contract every mechanic
implements: identity and description, selection tags, engine, match mode, answer
type, supported difficulties, plus `generate()` and `grade()`.

### The sub-skill vocabulary

Selection is a tag-overlap problem, so the interpreter and the mechanics must
draw from the *same* fixed set — a tag the interpreter invents matches nothing.
The 25 tags live in `lib/mechanics/subskills.ts` as a union type, with
`coerceSubSkills()` dropping anything outside it from model output.

### Where the answer lives

The LLM returns the full schema from the spec, including `correctIndex` and
`explanation`. The mechanic then **splits it**: `content` becomes just what the
player sees (`{stem, options}`), the index becomes `PuzzleInstance.solution`, and
the prose becomes `PuzzleInstance.explanation`.

This keeps the answer key out of the object handed to the renderer, and maps the
schema onto `PuzzleInstance` without duplicating fields.

## The registry

`lib/mechanics/index.ts` holds `id → Mechanic`. `catalog()` returns the trimmed
`CatalogEntry[]` the planner sees. Registering the same id twice throws — a
silent overwrite would mean a mechanic quietly disappearing from selection.

**Renderers are registered separately, by mechanic id**, in
`components/renderers/`. That's deliberate: it keeps `lib/mechanics/*` free of
React, so generators and graders run server-side and in tests without a DOM.

The renderer lookup is a `switch`, not an `id → component` map. A component
looked up dynamically during render is a new element type whenever the lookup
identity changes, which remounts it and silently discards a half-drawn puzzle.

## Generation pipeline

1. **`POST /api/interpret { prompt }` → `SkillContext`.** One model call maps free
   text onto a canonical skill, a subset of the sub-skill vocabulary, a domain,
   and `needsClarification` with a question if the prompt is too vague to pick
   sub-skills.
2. **`select(skillContext)` → 3–4 mechanics.** The model chooses from the fixed
   catalog, enforcing variety (not four multiple-choice puzzles) and at least one
   easier win. This is what makes the app feel like it picked the right puzzle
   for the request. A deterministic tag-overlap scorer stays as a cheap fallback
   for when a model call fails, and for offline testing.
3. **`generate()` per selected mechanic.** Procedural runs its TypeScript
   generator; LLM mechanics go through content-fill → Zod → retry ≤2. A mechanic
   that can't produce a valid instance falls through to the next-ranked one, so
   the user always gets a full set.
4. Return `PuzzleInstance[]` as option cards.

Steps 1–2 can be a single planner call, and for MVP the whole thing may collapse
into one `POST /api/generate { prompt }`.

## Grading

- **Deterministic mechanics** (`exact`, `set`, `range`, `path`, `grid`) grade in
  `grade()` — pure functions over the answer and the rules.
- **Open mechanics** grade server-side via `POST /api/grade` using an LLM judge
  with an explicit rubric, returning a 0–1 score plus feedback. The rubric and
  solution stay server-side.
- **Always return an `explanation`.** That's the learning payload — the reason
  the user is here.

## Zip in particular

Zip is the one mechanic with a verified prototype behind it, and its generator
guarantees solvability by construction:

1. Build a full Hamiltonian path covering every cell (Warnsdorff with
   backtracking, falling back to a boustrophedon snake, which always exists).
2. Place numbered checkpoints **along that path**, in path order — endpoints
   first, so 1 is the start and *k* is the end.
3. Add walls **only on edges the path never uses**, so the solution stays valid.

The stored path is a concrete solution, so a board can never be unsolvable.

Grading checks the four rules rather than comparing against the stored path:
one continuous line, starting at 1, hitting checkpoints in ascending order,
visiting every cell exactly once, moving orthogonally, never crossing a wall. Any
valid path is accepted.

The board also refuses illegal moves *as you draw* (`canEnter`), so a submitted
path is always well-formed and grading only has to judge completeness and order.

## Mobile and PWA

Designed for ~380px first. Puzzle boards are laid out in a fixed SVG user-space
grid and scaled to 100% width, so they stay legible on a phone and sharp on a
desktop. Touch targets are ≥44px. Drawing works by pointer and touch.

The PWA layer (Phase 3) adds a manifest with `display: standalone`, icons at
192px and 512px, an `apple-touch-icon` with the iOS status-bar meta tags, and a
minimal service worker caching the app shell.

Full offline play is out of scope: generation needs the network. The procedural
mechanics *could* run offline later, since they need no model call.

## Configuration

| | |
|---|---|
| `ANTHROPIC_API_KEY` | Required for LLM mechanics. Server-side only. |
| `SEED` | Optional. Fixes procedural generation for reproducible tests. |
| Model | Pinned in one constant in `lib/config.ts`. |

`requireApiKey()` throws rather than constructing a keyless client, so a missing
key fails loudly at the route instead of confusingly at the model call.
