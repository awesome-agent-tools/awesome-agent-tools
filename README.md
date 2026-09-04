# awesome-agent-tools

A buying guide for agent tools, organised by capability. Behaviour is read out
of each implementation's source, key numbers are measured here, and every claim
carries where it came from.

**[awesome-agent-tools.com](https://awesome-agent-tools.com)**

## What this is

A comparison site in the Wirecutter shape: each capability gets one page, and
each page leads with a conclusion. What separates it from a link list is that
the comparisons are produced here — read out of the source, or measured — rather
than aggregated from what other people already said.

It is deliberately **not** a wiki (neutrality fights the point of having a
view), not an awesome-list (moves existing signal around without creating any),
and not a leaderboard (invites endless appeals and implies a single ranking
exists).

## The distinction the whole site rests on

Comparison data splits in two, and getting the line right is the actual
contribution:

- **Invariants** — things every implementation should hold to. Violating one is
  a bug. These render as pass/fail. *Pagination must reassemble into the original
  file. Truncation must be announced. Binary content must not silently enter the
  context window. Line N in a grep result must be line N in a read.*
- **Design choices** — places implementations legitimately differ. These are
  recorded and never scored. *0- vs 1-indexed. Line-number format. Line caps.
  Whether images come back inline or as a separate tool.*

Qwen Code's 0-indexed read is a choice, and marking it as a failure would be
wrong. "Silently overwrites an edit made after the read" is a defect, and no
amount of intent changes that.

This is enforced in code, not just in prose: `class: invariant` is what permits
a pass/fail rendering, and `src/components/ObservationValue.astro` will not
render a design choice as a failure no matter what a template asks for.

## Observations and measurements are different things

| | Source of truth | Rendered as |
|---|---|---|
| **Observation** | read from source or docs — `source_url` + `commit` | a value with a link to where it was read |
| **Measurement** | produced by running a benchmark — a `run` | a number with `benchmark@version` and a run date |

Two measurements are comparable **only** when both the metric and the protocol
version match. Putting two differently-produced numbers in one table is the
fastest way for a site like this to stop being worth reading, so the check
script flags any metric with numbers under more than one protocol version.

## Repository layout

```
data/                    the database — YAML, read at build time
  capabilities.yaml      one entry per comparison page
  observation-keys.yaml  the registry of recordable facts, and invariant vs choice
  metrics.yaml           what gets measured
  featured.yaml          homepage cards, each one a query
  agents/<id>.yaml       harnesses
  packages/<id>.yaml     installables (MCP servers, libraries, hosted)
  tools/<owner>/<name>.yaml   the tools themselves — path mirrors the URL
  benchmarks/<id>.yaml   protocols, versioned
  runs/<id>.yaml         one execution batch and the measurements it produced

content/
  capabilities/<id>.md   editorial layer: recommendation and prose, optional
  posts/<slug>.md        posts

src/
  lib/schema.ts          zod schemas — one record at a time
  lib/db.ts              loads data/, builds indexes, joins
  lib/integrity.ts       cross-record rules zod cannot see
  lib/queries.ts         derived views: tallies, divergences
  pages/                 routes
scripts/
  check.ts               validation, gates the build
  refresh-signals.ts     weekly stars / last-commit refresh
  seed/import-research.ts  one-time import of docs/research/
```

## Running it

Requires Node 22.12+ (see `.nvmrc`).

```bash
npm install
npm run check     # validate data/ — cross-references, sources, comparability
npm run dev       # dev server
npm run build     # check + build to dist/
```

`npm run build` runs `check` first. Broken references, an observation asserting a
value with no source, or a measurement against a benchmark version that was
never declared will all fail the build rather than reach the site.

## Adding data

**A fact about a tool** — add an entry to `observations:` in the tool's file.
The `key` must already exist in `data/observation-keys.yaml`; add it there
first, deciding whether it is an invariant or a design choice. Every asserted
value needs a `source_url`, or the tool needs a `source` block for it to
inherit.

**A new capability** — only if you can write the question its page answers. If
you cannot, it is a tool attribute, not a capability. The tool matrix records
plenty of finer-grained functions that are not capabilities and should stay that
way until there is a comparison worth reading.

**A measurement** — write the benchmark protocol in `data/benchmarks/` *first*,
then add a run in `data/runs/`. Record failures as `status: error` with a note:
a server that would not install is a finding, and a blank cell hides it.
Illustrative numbers must set `draft: true`, which renders a visible badge.

## Machine-readable

Content is server-rendered HTML — no client-side rendering of tables, no data
locked inside images — because people already ask their agents to research
choices like these.

- `/api/db.json` — the whole database
- `/api/capabilities/<id>.json` — one capability with tallies
- `/llms.txt` — plain-text site map with current conclusions inlined
- `/rss.xml`, `/sitemap-index.xml`

## Provenance

`docs/research/` holds the two hand-built research artifacts this started from:
a nine-implementation comparison of the `read` tool and a thirteen-agent tool
matrix, both read from source. `scripts/seed/import-research.ts` reshapes them
into `data/` and adds no facts. Where the two disagree, the HTML is the
original.

## Licence

MIT, code and data alike. Quoting a number is the point — when you do, name the
protocol version and the run date alongside it, or it cannot be interpreted.

**Except `public/logos/`.** Those files are the product marks of the harnesses
being compared, and they belong to their respective owners — the MIT grant above
does not extend to them. They are reproduced here only to identify which harness
a row refers to, which is nominative use, not a claim of affiliation and not an
endorsement by any of the vendors. Each file's origin is recorded in a comment
above the `logo:` field in that agent's `data/agents/<id>.yaml`. If you own one
of these marks and would rather it were not here, open an issue and it will be
removed.
