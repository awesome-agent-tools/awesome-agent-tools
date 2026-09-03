# Repository Guidelines

Read `README.md` first for what this site is and why the data is shaped as it
is. This file covers working in the repo.

## Commands

- `npm run check` — validates `data/`. Run after any YAML edit.
- `npm run build` — runs `check`, then builds. Run after touching `src/`.
- `npm run dev` — dev server.
- `npm run refresh-signals` — stars and last-commit dates; set `GITHUB_TOKEN`.

Node 22.12+ (`.nvmrc`).

## The rules that are not style preferences

**Never assert a fact without a source.** An observation with `status: ok` needs
a `source_url`, or its tool needs a `source` block to inherit. `check` enforces
this. If you cannot link it, record `status: unverified` instead — that is a
real, useful state, not a failure to fill in a cell.

**Do not collapse "unverified" into "absent".** `status: unverified` renders
`?`, `not-applicable` renders `—`, and a missing observation renders `—`. An
empty cell claims the behaviour is not there; that is a different assertion from
not having checked, and conflating them is how comparison sites lose their
credibility.

**Never invent a commit hash, a star count, or a measurement.** If a number was
not produced by a run, it does not go in `data/`. Illustrative figures need
`draft: true` on the run, which renders a visible badge. `check` will warn about
sources missing a commit — that debt is meant to stay visible.

**Invariant vs design choice is decided in `data/observation-keys.yaml`, not in
a template.** Before adding a key, decide which it is. If a reasonable
implementer could choose differently and be right, it is a design choice and it
must never render as pass/fail.

**Capability pages follow the database; posts freeze.** On a capability page,
prefer a `derive:` KPI over a typed-in number — a hand-typed figure goes stale
and the page starts contradicting its own table. Posts are the opposite: they
copy numbers and keep them, and are not edited after publication.

## Conventions

- Slugs are lowercase-hyphenated. Tool file paths mirror URLs:
  `data/tools/claude-code/read.yaml` → `/tools/claude-code/read`.
- `exposed_name` is verbatim, casing untouched. The literal string is data.
- A capability slug must never equal a tool-owner slug — `/tools/<x>` would be
  ambiguous. `check` enforces this.
- 2-space YAML and TypeScript indentation. No linter is configured; match the
  file you are in.
- Comments in `data/` explain *why* a value is what it is. `refresh-signals`
  preserves them; keep it that way.

## Regenerating seed data

`scripts/seed/import-research.ts` overwrites `data/agents/` and `data/tools/`
wholesale. It was a one-time import from `docs/research/`. Once anything is
hand-edited in those directories, treat the script as history and do not re-run
it.
