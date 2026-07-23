# PRD — Skill Puzzles

*Product requirements. For implementation detail see
[`ARCHITECTURE.md`](ARCHITECTURE.md); for sequencing see
[`ROADMAP.md`](ROADMAP.md). Both derive from
[`../skill-puzzle-generator-BUILD-SPEC.md`](../skill-puzzle-generator-BUILD-SPEC.md),
which stays the source of truth.*

---

## 1. What we're building

A webapp where a user types a skill they want to improve — *"I want to improve my
critical thinking"*, *"improve my vocabulary"* — and the app generates a few
(3–4) tailored, self-contained puzzles to practise it. The user picks one, plays
it inline, gets instant grading plus an explanation, and can request another or a
harder one.

## 2. Why this shape

Two things make it feel different from a generic puzzle app:

- **Everything comes from the user's own words.** There is no fixed daily
  catalog. What appears is a response to what they asked for.
- **The match is legible.** Every card states what it trains, so the user can see
  *why* this puzzle answers their request rather than having to take it on faith.

## 3. Hard scope boundaries

These are constraints, not preferences. Violating any of them changes what the
product is.

- **Puzzles and challenges only — not games.** No game engines, levels, physics,
  sprites, narrative, timers-as-gameplay, or persistent game worlds. Each output
  is a single self-contained exercise, completable in under ~2 minutes, with a
  checkable answer or a rubric-gradable response.
- **Everything is generated from the user's prompt.** The free-text request
  drives which puzzles appear and what's in them.
- **Nothing unverified reaches the user.** Every puzzle passes its engine's
  correctness check before it renders. A broken or unsolvable puzzle is the #1
  failure mode, and the architecture exists to prevent it.

## 4. The core loop

```
user types skill  →  interpret skill  →  select 3–4 mechanics  →
generate an instance of each  →  show option cards  →  user picks one  →
play  →  grade + explain  →  { try another | make it harder | new skill }
```

## 5. Scope

**In (MVP)**

Chat input · skill interpretation · mechanic selection · 4 mechanics at launch
growing to ~15 · procedural + LLM generation · inline play · deterministic and
LLM-judge grading · explanations · three difficulty levels · *try another* /
*make it harder* / *new skill* · optional `localStorage` progress · mobile-first
responsive UI · installable as a PWA.

**Out (deferred)**

Accounts and auth · a server database · cloud sync · multiplayer or social ·
streaks and daily sets · spaced repetition · a mobile-native build ·
monetisation. MVP stays client-heavy with a thin API layer.

## 6. Users and context of use

One person, on a phone, with a couple of minutes and something specific they
want to get better at. Design implications that follow from that:

- Design for a ~380px viewport first; everything else is an adaptation upward.
- Every mechanic must be fully playable by touch — including the ones that
  involve drawing.
- Time-to-first-puzzle matters more than breadth. Show skeleton cards while
  generating rather than a blank screen.
- It has to survive being added to a home screen and launched like an app.

## 7. Quality guardrails

Non-negotiable, because a wrong or unsolvable puzzle destroys trust faster than
a missing feature.

| Engine | The check |
|---|---|
| LLM content-fill | Output must pass Zod validation. Retry at most twice; on failure the mechanic is dropped, never shown malformed. |
| Procedural | Generate-then-verify: a solver confirms a solution exists, and that it's unique at medium/hard. Regenerate if not. |

Plus: a light content filter on generated text, and a thumbs-down on the play
surface so a user can report a bad puzzle — a quality signal for later.

When a mechanic can't produce a valid instance, the pipeline silently falls
through to the next-ranked one, so the user still gets a full set of options
rather than a gap.

## 8. Difficulty

Three levels — easy, medium, hard — passed into every generator, which maps them
onto its own parameters (Zip grid size; cloze word rarity and how close the
distractors sit; fallacy subtlety; sequence rule depth). *Make it harder*
regenerates the same mechanic one level up.

## 9. Screens

1. **Home / chat** — input box plus three seeded example prompts. Submitting
   shows skeleton cards while generating.
2. **Option gallery** — 3–4 cards, each with a title, what it trains, a
   difficulty pill, and Play.
3. **Play surface** — the mechanic, then Submit → feedback with the correct/
   incorrect verdict, a short specific note, the explanation, and why it helps.
   Actions: *try another*, *make it harder*, *new skill*.
4. **Clarify state** — if the prompt is too vague to pick sub-skills (*"improve
   at games"*), one clarifying question appears as a chat bubble before
   generating. Exactly one — it's a nudge, not an interview.
5. **Broken-puzzle report** — a small thumbs-down on the play surface.

## 10. Success criteria

The product works when:

- *"improve my vocabulary"* returns word puzzles and *"improve my planning"*
  returns Zip and sequences — and each card makes the connection legible.
- The full loop, from typing a skill to reading an explanation, feels smooth on a
  phone.
- No user ever meets an unsolvable or malformed puzzle.
- The deployed URL installs to an iPhone home screen and runs fullscreen.

## 11. Explicit non-goals

No full games, levels, physics, narrative, or game loops. No accounts, server
database, multiplayer, or monetisation in MVP. Puzzles and challenges only,
generated from the user's prompt, always verified before display.
