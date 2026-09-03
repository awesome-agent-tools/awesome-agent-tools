import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { z, ZodTypeAny } from "zod";
import {
  agentSchema,
  benchmarkSchema,
  capabilitySchema,
  featuredSchema,
  metricSchema,
  observationKeySchema,
  packageSchema,
  runSchema,
  toolSchema,
  type Agent,
  type Benchmark,
  type Capability,
  type Featured,
  type Measurement,
  type Metric,
  type Observation,
  type ObservationKey,
  type Package,
  type Run,
  type Tool,
} from "./schema";

/**
 * The database is a directory of YAML files read into memory at build time.
 * Entity counts here are in the hundreds, so every join below is a plain array
 * scan over a Map — there is no query planner and there does not need to be.
 *
 * This module is deliberately runtime-agnostic (no `astro:` imports) so that
 * `scripts/check.ts` can validate the same data in CI without booting Astro.
 */

export const DATA_DIR = path.resolve(process.cwd(), "data");

export class DataError extends Error {
  constructor(
    public file: string,
    message: string,
  ) {
    super(`${file}: ${message}`);
  }
}

function readYaml(file: string): unknown {
  const raw = fs.readFileSync(file, "utf8");
  try {
    return parseYaml(raw);
  } catch (err) {
    throw new DataError(rel(file), (err as Error).message);
  }
}

function rel(file: string): string {
  return path.relative(path.dirname(DATA_DIR), file);
}

// Generic over the schema rather than over a result type: zod's input and
// output types differ wherever a field has a default, and pinning the generic
// to the input type makes every defaulted field look optional downstream.
function validate<S extends ZodTypeAny>(schema: S, value: unknown, file: string): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new DataError(rel(file), `schema validation failed\n${detail}`);
  }
  return result.data;
}

/** Every *.yaml under `dir`, recursively, sorted for deterministic output. */
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) out.push(full);
  }
  return out;
}

function loadList<S extends ZodTypeAny>(file: string, schema: S): z.infer<S>[] {
  const full = path.join(DATA_DIR, file);
  if (!fs.existsSync(full)) return [];
  const parsed = readYaml(full);
  if (!Array.isArray(parsed)) {
    throw new DataError(rel(full), "expected a top-level list");
  }
  return parsed.map((item) => validate(schema, item, full));
}

function loadDir<S extends ZodTypeAny>(sub: string, schema: S, withId = true): z.infer<S>[] {
  return walk(path.join(DATA_DIR, sub)).map((file) => {
    const parsed = readYaml(file);
    if (parsed === null || typeof parsed !== "object") {
      throw new DataError(rel(file), "expected a top-level mapping");
    }
    // The filename is the identifier; carrying it inside the file too would let
    // the two drift apart.
    const id = path.basename(file).replace(/\.ya?ml$/, "");
    const value = withId ? { id, ...(parsed as object) } : parsed;
    return validate(schema, value, file);
  });
}

/* ------------------------------------------------------------------ types */

export interface Owner {
  type: "agent" | "package";
  id: string;
  name: string;
  vendor?: string;
  href: string;
}

export interface ToolRecord extends Tool {
  /** `<owner>/<name>`, e.g. `claude-code/read`. Mirrors both the file path and
   *  the URL, so a table row can be cited precisely. */
  id: string;
  name: string;
  ownerRef: Owner;
  href: string;
}

export interface MeasurementRecord extends Measurement {
  run: Run;
}

export interface AdoptionCount {
  pkg: Package;
  agents: Agent[];
  bundled: number;
}

/* ----------------------------------------------------------------- loader */

function loadTools(): Omit<ToolRecord, "ownerRef" | "href">[] {
  const root = path.join(DATA_DIR, "tools");
  return walk(root).map((file) => {
    const parsed = readYaml(file);
    if (parsed === null || typeof parsed !== "object") {
      throw new DataError(rel(file), "expected a top-level mapping");
    }
    const name = path.basename(file).replace(/\.ya?ml$/, "");
    const ownerDir = path.basename(path.dirname(file));
    const tool = validate(toolSchema, parsed, file);
    if (tool.owner.id !== ownerDir) {
      throw new DataError(
        rel(file),
        `owner.id is "${tool.owner.id}" but the file sits under tools/${ownerDir}/`,
      );
    }
    return { ...tool, id: `${ownerDir}/${name}`, name };
  });
}

export interface Db {
  capabilities: Capability[];
  metrics: Metric[];
  observationKeys: ObservationKey[];
  agents: Agent[];
  packages: Package[];
  tools: ToolRecord[];
  benchmarks: Benchmark[];
  runs: Run[];
  featured: Featured[];

  capability(id: string): Capability | undefined;
  agent(id: string): Agent | undefined;
  package(id: string): Package | undefined;
  tool(id: string): ToolRecord | undefined;
  metric(id: string): Metric | undefined;
  benchmark(id: string): Benchmark | undefined;
  run(id: string): Run | undefined;
  observationKey(key: string): ObservationKey | undefined;
  owner(ref: { type: "agent" | "package"; id: string }): Owner | undefined;

  toolsByCapability(capabilityId: string): ToolRecord[];
  toolsByOwner(type: "agent" | "package", id: string): ToolRecord[];
  keysForCapability(capabilityId: string): ObservationKey[];
  observationOn(subject: { observations: Observation[] }, key: string): Observation | undefined;
  adoptionOf(packageId: string): Agent[];
  adoptionRanking(): AdoptionCount[];
  coverageMatrix(): { agents: Agent[]; rows: { capability: Capability; cells: ("full" | "partial" | "none")[] }[] };
  runsForBenchmark(benchmarkId: string): Run[];
  measurementsFor(runId: string, metricId: string): MeasurementRecord[];
  measurementsForSubject(type: string, id: string): MeasurementRecord[];
  subjectLabel(ref: { type: string; id: string }): { name: string; href: string | null };
  lastUpdated(): Date;
}

function build(): Db {
  const capabilities = loadList("capabilities.yaml", capabilitySchema).sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
  const metrics = loadList("metrics.yaml", metricSchema);
  const observationKeys = loadList("observation-keys.yaml", observationKeySchema);
  const featured = loadList("featured.yaml", featuredSchema);
  const agents = loadDir("agents", agentSchema);
  const packages = loadDir("packages", packageSchema);
  const benchmarks = loadDir("benchmarks", benchmarkSchema);
  const runs = loadDir("runs", runSchema);
  const rawTools = loadTools();

  const capIndex = new Map(capabilities.map((c) => [c.id, c]));
  const metricIndex = new Map(metrics.map((m) => [m.id, m]));
  const keyIndex = new Map(observationKeys.map((k) => [k.key, k]));
  const agentIndex = new Map(agents.map((a) => [a.id, a]));
  const packageIndex = new Map(packages.map((p) => [p.id, p]));
  const benchmarkIndex = new Map(benchmarks.map((b) => [b.id, b]));
  const runIndex = new Map(runs.map((r) => [r.id, r]));

  function owner(ref: { type: "agent" | "package"; id: string }): Owner | undefined {
    if (ref.type === "agent") {
      const a = agentIndex.get(ref.id);
      return a && { type: "agent", id: a.id, name: a.name, vendor: a.vendor, href: `/agents/${a.id}` };
    }
    const p = packageIndex.get(ref.id);
    return p && { type: "package", id: p.id, name: p.name, vendor: p.vendor, href: `/packages/${p.id}` };
  }

  const tools: ToolRecord[] = rawTools.map((t) => {
    const ownerRef = owner(t.owner) ?? {
      type: t.owner.type,
      id: t.owner.id,
      name: t.owner.id,
      href: "#",
    };
    return { ...t, ownerRef, href: `/tools/${t.id}` };
  });
  const toolIndex = new Map(tools.map((t) => [t.id, t]));

  const db: Db = {
    capabilities,
    metrics,
    observationKeys,
    agents,
    packages,
    tools,
    benchmarks,
    runs,
    featured,

    capability: (id) => capIndex.get(id),
    agent: (id) => agentIndex.get(id),
    package: (id) => packageIndex.get(id),
    tool: (id) => toolIndex.get(id),
    metric: (id) => metricIndex.get(id),
    benchmark: (id) => benchmarkIndex.get(id),
    run: (id) => runIndex.get(id),
    observationKey: (key) => keyIndex.get(key),
    owner,

    toolsByCapability(capabilityId) {
      // A tool tagged with two capabilities appears on both pages. That is
      // intended: the pages are comparisons, not a partition.
      return tools
        .filter((t) => t.capabilities.some((c) => c.id === capabilityId))
        .sort((a, b) => a.ownerRef.name.localeCompare(b.ownerRef.name));
    },

    toolsByOwner(type, id) {
      return tools
        .filter((t) => t.owner.type === type && t.owner.id === id)
        .sort((a, b) => a.exposed_name.localeCompare(b.exposed_name));
    },

    keysForCapability(capabilityId) {
      return observationKeys
        .filter((k) => k.capability === capabilityId)
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    },

    observationOn(subject, key) {
      return subject.observations.find((o) => o.key === key);
    },

    adoptionOf(packageId) {
      return agents.filter((a) => a.adoption.some((ad) => ad.package === packageId));
    },

    adoptionRanking() {
      return packages
        .map((pkg) => {
          const adopters = agents.filter((a) => a.adoption.some((ad) => ad.package === pkg.id));
          const bundled = agents.filter((a) =>
            a.adoption.some((ad) => ad.package === pkg.id && ad.kind === "bundled"),
          ).length;
          return { pkg, agents: adopters, bundled };
        })
        .filter((r) => r.agents.length > 0)
        .sort((a, b) => b.bundled - a.bundled || b.agents.length - a.agents.length || a.pkg.name.localeCompare(b.pkg.name));
    },

    coverageMatrix() {
      const ordered = [...agents].sort((a, b) => a.name.localeCompare(b.name));
      const rows = capabilities.map((capability) => ({
        capability,
        cells: ordered.map((agent) => {
          const owned = tools.filter(
            (t) =>
              t.owner.type === "agent" &&
              t.owner.id === agent.id &&
              t.capabilities.some((c) => c.id === capability.id),
          );
          if (owned.length === 0) return "none" as const;
          // "partial" means the capability is reached, but not by a tool built
          // for it — Codex reading files through the shell, say.
          const dedicated = owned.some((t) =>
            t.capabilities.some((c) => c.id === capability.id && c.role === "primary"),
          );
          return dedicated ? ("full" as const) : ("partial" as const);
        }),
      }));
      return { agents: ordered, rows };
    },

    runsForBenchmark(benchmarkId) {
      return runs
        .filter((r) => r.benchmark === benchmarkId)
        .sort((a, b) => b.date.getTime() - a.date.getTime());
    },

    measurementsFor(runId, metricId) {
      const run = runIndex.get(runId);
      if (!run) return [];
      return run.measurements
        .filter((m) => m.metric === metricId)
        .map((m) => ({ ...m, run }));
    },

    measurementsForSubject(type, id) {
      const out: MeasurementRecord[] = [];
      for (const run of runs) {
        for (const m of run.measurements) {
          if (m.subject.type === type && m.subject.id === id) out.push({ ...m, run });
        }
      }
      return out.sort((a, b) => b.run.date.getTime() - a.run.date.getTime());
    },

    subjectLabel(ref) {
      if (ref.type === "tool") {
        const t = toolIndex.get(ref.id);
        return t ? { name: `${t.ownerRef.name} ${t.exposed_name}`, href: t.href } : { name: ref.id, href: null };
      }
      if (ref.type === "agent") {
        const a = agentIndex.get(ref.id);
        return a ? { name: a.name, href: `/agents/${a.id}` } : { name: ref.id, href: null };
      }
      const p = packageIndex.get(ref.id);
      return p ? { name: p.name, href: `/packages/${p.id}` } : { name: ref.id, href: null };
    },

    lastUpdated() {
      let latest = new Date(0);
      const bump = (d?: Date) => {
        if (d && d.getTime() > latest.getTime()) latest = d;
      };
      for (const r of runs) bump(r.date);
      for (const t of tools) {
        bump(t.source?.checked_at);
        for (const o of t.observations) bump(o.checked_at);
      }
      for (const a of agents) bump(a.signals_checked_at);
      for (const p of packages) bump(p.signals_checked_at);
      return latest.getTime() === 0 ? new Date() : latest;
    },
  };

  return db;
}

let cached: Db | null = null;

/** Loaded once per process; Astro renders every page in the same process. */
export function loadDb(): Db {
  if (!cached) cached = build();
  return cached;
}
