import { z } from "zod";

/**
 * Field shapes for everything under `data/`.
 *
 * These schemas cover one record at a time. Anything that spans records — a
 * tool pointing at an owner that must exist, a measurement whose benchmark
 * version must have been declared — lives in `integrity.ts`, because zod can
 * only see one file at a time.
 */

const slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "must be lowercase-hyphenated");

const isoDate = z.coerce.date();

/** Where a fact came from. Not optional anywhere it appears — this is the whole
 *  credibility story, so the schema refuses to let a fact in without one. */
export const sourceSchema = z.object({
  url: z.string().url(),
  commit: z.string().optional(),
  checked_at: isoDate,
});

export type Source = z.infer<typeof sourceSchema>;

/**
 * `ok` carries a value. `unverified` means we tried and could not confirm it
 * (renders `?`). `not-applicable` means the question is meaningless for this
 * subject (renders `—`). Collapsing the last two would throw away the most
 * honest thing the research artifacts record.
 */
export const observationStatus = z.enum(["ok", "unverified", "not-applicable"]);

export const observationSchema = z
  .object({
    key: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    status: observationStatus.default("ok"),
    note: z.string().optional(),
    source_url: z.string().url().optional(),
    commit: z.string().optional(),
    checked_at: isoDate.optional(),
    method: z
      .enum(["source", "docs", "runtime", "measured"])
      .default("source"),
  })
  .refine((o) => o.status !== "ok" || o.value !== undefined, {
    message: "an observation with status 'ok' must carry a value",
  });

export type Observation = z.infer<typeof observationSchema>;

/**
 * The registry of observation keys. Two jobs beyond naming hygiene:
 *  - `class` decides how a value may be rendered. An `invariant` may show as
 *    pass/fail; a `design-choice` may not, ever. That rule is what stops the
 *    site from marking Qwen's 0-indexed read as a failure.
 *  - `group` + `order` drive comparison-table row grouping, so the ordering
 *    lives in data rather than hardcoded in a template.
 */
export const observationKeySchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/, "must be lower_snake_case"),
  label: z.string(),
  /** Column-header form, for tables where the full label would not fit. Falls
   *  back to `label`. */
  short: z.string().optional(),
  group: z.string(),
  capability: slug.optional(),
  type: z.enum(["enum", "boolean", "number", "string"]),
  values: z.array(z.string()).optional(),
  /** `invariant`: violating it is a bug every implementation should avoid.
   *  `design-choice`: differing is a difference, recorded but never judged. */
  class: z.enum(["invariant", "design-choice"]),
  /** True when the fact clears the four-filter test in product.md §5. */
  headline: z.boolean().default(false),
  /** For invariants: which value counts as holding up. */
  holds_when: z.string().optional(),
  /** Set false for keys where differing carries no information — a tool's own
   *  name differs from every other tool's name by definition, and reporting
   *  that as a divergence is noise. */
  divergence: z.boolean().default(true),
  description: z.string().optional(),
  order: z.number().default(0),
});

export type ObservationKey = z.infer<typeof observationKeySchema>;

export const capabilitySchema = z.object({
  id: slug,
  name: z.string(),
  /** The question the comparison page answers. If you cannot write one, this
   *  capability should not exist (product.md §6). */
  question: z.string(),
  description: z.string(),
  order: z.number().default(0),
});

export type Capability = z.infer<typeof capabilitySchema>;

export const metricSchema = z.object({
  id: slug,
  name: z.string(),
  unit: z.string(),
  type: z.enum(["number", "boolean", "enum", "string"]),
  /** Why it matters — the argument for putting it in a headline. */
  why: z.string(),
  /** Lower is better; drives bar-chart ordering and "median" copy. */
  lower_is_better: z.boolean().default(true),
});

export type Metric = z.infer<typeof metricSchema>;

const signals = {
  stars: z.number().int().nonnegative().optional(),
  downloads: z.number().int().nonnegative().optional(),
  last_commit: isoDate.optional(),
  signals_checked_at: isoDate.optional(),
};

export const adoptionSchema = z.object({
  package: slug,
  /** bundled ships it, recommended points at it, documented merely mentions it.
   *  Cost paid by the signaller descends in that order. */
  kind: z.enum(["bundled", "recommended", "documented"]),
  source_url: z.string().url(),
  note: z.string().optional(),
});

export const agentSchema = z.object({
  id: slug,
  name: z.string(),
  vendor: z.string(),
  kind: z.enum(["cli", "ide", "framework", "assistant"]),
  repo: z.string().url().optional(),
  homepage: z.string().url().optional(),
  language: z.string().optional(),
  license: z.string().optional(),
  /** Path under public/ to the product's mark, vendored rather than hotlinked so
   *  a page view never pings a vendor's CDN. Purely for recognition — it is not
   *  a fact about the harness and nothing is derived from it, which is why it
   *  needs no source block. The comment above each value records where the file
   *  came from. */
  logo: z.string().optional(),
  /** Set when there is no public repo to read — the site says so rather than
   *  quietly showing a thinner row. */
  source_available: z.boolean().default(true),
  ...signals,
  adoption: z.array(adoptionSchema).default([]),
  observations: z.array(observationSchema).default([]),
  /** How the tool list was established when it was not read from published
   *  source — from the running harness, from docs. Three agent files have
   *  carried one since the seed import; without this field zod stripped it and
   *  the caveat never reached the page. Mirrors `notes` on toolSchema. */
  notes: z.string().optional(),
});

export type Agent = z.infer<typeof agentSchema>;

export const packageSchema = z.object({
  id: slug,
  name: z.string(),
  vendor: z.string().optional(),
  kind: z.enum(["mcp-server", "library", "hosted"]),
  repo: z.string().url().optional(),
  homepage: z.string().url().optional(),
  registry: z.enum(["npm", "pypi", "cargo", "go", "none"]).default("none"),
  install_id: z.string().optional(),
  language: z.string().optional(),
  license: z.string().optional(),
  ...signals,
  observations: z.array(observationSchema).default([]),
});

export type Package = z.infer<typeof packageSchema>;

export const toolSchema = z.object({
  /** Verbatim, casing untouched. The literal name is data: models carry priors
   *  about tool names, and slugifying would erase that. */
  exposed_name: z.string(),
  owner: z.object({
    type: z.enum(["agent", "package"]),
    id: slug,
  }),
  capabilities: z
    .array(
      z.object({
        id: slug,
        role: z.enum(["primary", "partial", "batch"]).default("primary"),
      }),
    )
    .default([]),
  /** Path to a sibling .json file, relative to the tool's own directory. */
  schema_file: z.string().optional(),
  description_text: z.string().optional(),
  /** How this capability is reached when there is no dedicated tool for it —
   *  e.g. Codex reads files through the shell. */
  via: z.string().optional(),
  source: sourceSchema.optional(),
  observations: z.array(observationSchema).default([]),
  notes: z.string().optional(),
});

export type Tool = z.infer<typeof toolSchema>;

export const benchmarkSchema = z.object({
  id: slug,
  name: z.string(),
  capability: slug,
  question: z.string(),
  versions: z
    .array(
      z.object({
        version: z.string().regex(/^v\d+$/, "must look like v1"),
        /** Prose a person can follow to reproduce the run. */
        protocol: z.string(),
        /** git path + commit of the fixed inputs. Fixtures are files in the
         *  repo, not entities — the path carries their version already. */
        fixtures_ref: z.string().optional(),
        emits: z.array(slug).min(1),
        /** The post that first published this protocol. That post is the
         *  methodology page; there is no /methods route. */
        post: z.string().optional(),
        retired: z.boolean().default(false),
      }),
    )
    .min(1),
});

export type Benchmark = z.infer<typeof benchmarkSchema>;

export const measurementSchema = z.object({
  subject: z.object({
    type: z.enum(["tool", "package", "agent"]),
    id: z.string(),
  }),
  metric: slug,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  value_num: z.number().optional(),
  /** Without this the number is worthless a month later. */
  subject_version: z.string().optional(),
  /** `error` and `na` are recorded, not dropped: a tool that would not install
   *  is a finding, and a blank cell would hide it. */
  status: z.enum(["ok", "error", "na"]).default("ok"),
  note: z.string().optional(),
});

export type Measurement = z.infer<typeof measurementSchema>;

export const runSchema = z.object({
  id: z.string(),
  benchmark: slug,
  benchmark_version: z.string(),
  date: isoDate,
  /** The post that published these numbers. */
  post: z.string().optional(),
  /** Anything that would move the numbers: model, tokenizer, machine, network. */
  environment: z.record(z.string(), z.string()).default({}),
  notes: z.string().optional(),
  /** Illustrative numbers must say so. Nothing unmarked on this site is fake. */
  draft: z.boolean().default(false),
  measurements: z.array(measurementSchema).min(1),
});

export type Run = z.infer<typeof runSchema>;

/** Homepage cards. Most are named queries against the DB rather than literals —
 *  that is the difference between this and a listing site. */
export const featuredVisualSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bars"),
    run: z.string(),
    metric: slug,
    highlight: z.string().optional(),
    limit: z.number().int().positive().default(8),
  }),
  z.object({
    type: z.literal("coverage-matrix"),
  }),
  z.object({
    type: z.literal("adoption-rank"),
    limit: z.number().int().positive().default(5),
  }),
  z.object({
    type: z.literal("observation-lines"),
    capability: slug,
    key: z.string(),
    limit: z.number().int().positive().default(5),
    /** Rendered behind each recorded prefix so the difference is visible as
     *  bytes rather than described in prose. */
    sample: z.string().default("import fs"),
  }),
  z.object({
    type: z.literal("ratio"),
    capability: slug,
    key: z.string(),
    /** Count subjects whose value matches this. */
    counts: z.string(),
  }),
  z.object({
    type: z.literal("change"),
    from: z.string(),
    to: z.string(),
  }),
]);

export const featuredSchema = z.object({
  kind: z.string(),
  title: z.string(),
  blurb: z.string(),
  href: z.string(),
  foot: z.string().optional(),
  wide: z.boolean().default(false),
  visual: featuredVisualSchema,
});

export type Featured = z.infer<typeof featuredSchema>;
