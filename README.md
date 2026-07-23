# Skill Puzzles

A mobile-first webapp where you type a skill you want to improve — *"I want to get
better at critical thinking"* — and get 3–4 tailored, self-contained puzzles to
practise it. Pick one, play it inline, get instant grading plus an explanation,
then ask for another or a harder one.

**Puzzles and challenges only — never full games.** Each output is a single
exercise you finish in under ~2 minutes that has a checkable answer.

---

## The core idea

The app owns the rules, rendering, and grading. The LLM only supplies content.

An LLM is never asked to invent a puzzle freeform. It picks 3–4 entries from a
**fixed mechanic catalog** and fills their schemas. Anything it returns is
schema-validated before it can reach a screen, and the procedural mechanics are
verified solvable by construction. A broken or unsolvable puzzle is the failure
mode the whole architecture exists to prevent.

```
user types a skill  →  interpret it  →  pick 3–4 mechanics from the catalog  →
generate an instance of each  →  option cards  →  user picks one  →  play  →
grade + explain  →  { try another | make it harder | new skill }
```

## Two engines, one catalog

| | Engine A — Procedural | Engine B — LLM content-fill |
|---|---|---|
| **Used for** | logic, spatial, numeric puzzles with no semantic content | language, knowledge, and reasoning puzzles whose *content* carries meaning |
| **How** | pure TypeScript generators, seeded PRNG | the LLM returns structured JSON filling a fixed schema |
| **Correctness** | generate-then-verify — a solver confirms solvability | Zod validation, retry ≤2, then drop the mechanic |
| **Cost** | zero, no network | one model call |
| **Examples** | Zip, sequences, sudoku, mazes, mental math | fallacies, vocabulary cloze, analogies, categorisation |

Both engines emit the same `PuzzleInstance`, so everything downstream is
engine-agnostic.

Mechanics also differ in *how* they match a skill. **Content-matched** ones are
tailored by subject — a fallacy puzzle *is about* critical thinking.
**Cognitive-matched** ones are tailored by the mental faculty they exercise, so
Zip surfaces for "planning" or "logical reasoning" but never for "vocabulary".
Every card shows a `trainsLabel` so the match reads as deliberate rather than
random.

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | What we're building and why — scope, the core loop, quality bar |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How it's put together: engines, the registry, data models, invariants |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | The five build phases, their acceptance criteria, and current status |
| [`skill-puzzle-generator-BUILD-SPEC.md`](skill-puzzle-generator-BUILD-SPEC.md) | The original build-ready spec — the source of truth all three docs derive from |

## Status

**Phase 0 complete.** Scaffold plus a `/dev` harness rendering and grading one
hardcoded Zip board and one hardcoded multiple-choice puzzle. No generators are
wired up yet; the mechanic registry is deliberately empty until Phase 1. See
[`docs/ROADMAP.md`](docs/ROADMAP.md) for what each phase covers.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · `@anthropic-ai/sdk` ·
Zod. No database — React state, with `localStorage` for progress later.

Every Anthropic call runs server-side in an API route; the API key lives in an
env var and never reaches the client. The model is pinned in one constant
(`lib/config.ts`).

## Running it

```bash
npm install
cp .env.example .env.local     # then add your ANTHROPIC_API_KEY
npm run dev
```

- `http://localhost:3000` — home (placeholder until Phase 2)
- `http://localhost:3000/dev` — the mechanic harness

`ANTHROPIC_API_KEY` is only needed once the LLM mechanics land in Phase 1; the
procedural ones and the Phase 0 harness run without it.

```bash
npm run build     # production build (also typechecks)
npm run lint
```

## Project layout

```
app/
  page.tsx                  home — chat input + gallery (Phase 2)
  dev/page.tsx              dev harness: instantiate and play any mechanic
  api/                      interpret · generate · grade (Phase 2)
lib/
  config.ts                 model constant, env access
  rng.ts                    seeded PRNG (mulberry32)
  mechanics/
    types.ts                Mechanic, PuzzleInstance, SkillContext, GradeResult
    subskills.ts            the controlled sub-skill vocabulary
    index.ts                the registry — id → Mechanic
    zip.ts                  procedural
    multipleChoice.ts       shared pieces for the option-picking mechanics
  llm/                      SDK wrapper, content-fill + validate, judge (Phase 1)
  dev/fixtures.ts           hardcoded instances for the harness
components/
  PlayCard.tsx              renderer + submit + feedback
  renderers/                ZipBoard, MultipleChoice, and the id → renderer switch
```

Renderers live outside `lib/mechanics/` on purpose: generators and graders stay
free of React so they run server-side and in tests.

## Deployment

Vercel. Set `ANTHROPIC_API_KEY` as a project environment variable. Because every
model call happens in a server-side route, the key never ships to the phone.

From Phase 3 the app installs to a home screen as a PWA — open the deployed URL
in mobile Safari or Chrome and choose *Add to Home Screen*.
