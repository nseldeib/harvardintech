---
name: codeyam-manual-tests
description: Generate manual tests from recent commits — short, human-executable checks for the things an automated test cannot settle. Reads the commits since tests were last generated, maps them to the scenarios that demonstrate them, and writes one test per verifiable behavior. Also handles a freeform "write me tests for X" request, seeded from chat. Read-only on git; additive under .codeyam/.
---

# CodeYam — Generate Manual Tests

You author **manual tests**: short, human-executable checks recorded in the
repo at `.codeyam/manual-tests/`. Each one names something a person has to
confirm with their own eyes, and points at the scenario that puts the app in
the state the check needs.

This flow is safe to run:

- **Read-only on git.** You read history and diffs — never commit, amend,
  checkout, or reset.
- **Additive under `.codeyam/`.** Every write goes through
  `codeyam-editor editor manual-test-add`. You never edit application source.
- **Append-only.** Generation may deliberately re-cover ground. If a newer
  commit range touches something an older completed test already covered, you
  write a *fresh* test for the new range — you never reopen the old one. The
  old test stays a true record of what was verified then; the new one is what
  needs verifying now.

**Two entry points, one body.** Invoked bare, you cover everything not yet
covered. Invoked with an argument (a freeform request typed in chat), that
argument is a *focus filter* over phases 2–5 — you still establish the range
and read the diff, but you author against what the user asked about, and you
say so in the report if their request falls outside the changed set.

## Phase 1 — Establish the range

Run `codeyam-editor editor manual-test-status --format json`.

- **`lastGeneratedSha` present and resolvable** → that is your base. This is
  what makes "generate" mean "cover everything not yet covered", which is the
  only reading that keeps the commits-since counter honest.
- **`neverGenerated: true`** → there is no anchor. Ask the user what to cover,
  offering the merge-base with the primary branch ("everything on this branch")
  and a last-N-commits range. Confirm before proceeding.
- **`lastGeneratedShaUnreachable: true`** → the recorded commit is gone, almost
  always a rebase or squash. Say that plainly and ask for a base the same way.
  Do NOT silently fall back to a default range; the count the user sees depends
  on this choice.

## Phase 2 — Read the change

- `codeyam-editor editor changed-surfaces --base <sha> --format json` —
  partitions the change into `covered` (an existing scenario demonstrates it),
  `uncovered` (a renderable surface with no scenario yet), and `noUiImpact`
  (pure backend/util). Do NOT re-derive this mapping by hand; it walks the
  dependency graph and a second copy would drift.
- `git log --oneline <sha>..HEAD` — the commit subjects that ride in each
  test's `generatedFrom.commits`.

## Phase 3 — Read what already exists

`codeyam-editor editor manual-tests --format json`.

This is **context, not a filter**. An existing test over similar ground is a
*model* for the new one — same surface, same shape of steps. What it prevents
is authoring a second test for a range already generated.

## Phase 4 — Read the project's shape

`codeyam-editor editor project-info` for the app type and stack, so a
`noUiImpact` test is written against this project's real interface — its CLI,
its API, its library surface — rather than an assumed web page.

## Phase 5 — Author the tests

**One test per verifiable behavior.** Not one per commit, not one per changed
file. A commit renaming a variable across nine files is zero tests. A one-line
commit changing what a tooltip says is one test. Write nothing for changes with
no human-observable consequence, and say so in the report rather than padding.

Per partition:

- **`covered`** → surface `scenario`, carrying the slug, name, `scenarioType`
  (`application` or `component`) and a one-line reason. Steps open that
  scenario and exercise the specific thing that changed.
- **`uncovered`** → surface `uncovered`, carrying `uncoveredKind`
  (`component` or `route`), the name, and the file. **Still write the test.**
  Silently skipping surfaces with no scenario hides exactly the gaps that
  matter most; the UI renders it as "no scenario yet" with a route to capture
  one.
- **`noUiImpact`** → surface `noUiSurface` with a note, and steps describing a
  CLI or API verification. Write nothing only when the change genuinely has no
  observable effect.

Writing the fields:

- **`steps`** — imperative, short, one action each.
- **`expected`** — what the person *sees*, never what the code does.
- **`intent`** — why a human is needed: what changed, and what an automated
  test cannot settle about it.
- **`title`** — one line naming what is being verified.

## Phase 6 — Write them

One `codeyam-editor editor manual-test-add --file <path>` per test, from a
scratch JSON under `.codeyam/tmp/`. Use a unique filename per call.

Omit `id` and let the command derive it from the title — it de-duplicates a
collision with a numeric suffix rather than clobbering, which matters because
two tests from different commit ranges legitimately share a title.

## Phase 7 — Stamp the marker

`codeyam-editor editor manual-test-mark-generated`, **exactly once, and only
after every add has succeeded.**

A partial run must not stamp. Stamping resets the commits-since counter, so
stamping after a failed add silently drops the commits those tests would have
covered — they would never be offered again.

## Phase 8 — Report

Tell the user:

- How many tests you wrote, and against which commit range.
- What you deliberately did **not** cover, and why — the renames, the
  refactors, the changes with no observable consequence. Naming these is what
  makes the count trustworthy.
- Any surface that got a test but has no scenario yet, so they can decide
  whether to capture one.

Never tell the user to run `codeyam-editor editor` commands; they are internal.
Just tell them what you found and ask what they want next.
