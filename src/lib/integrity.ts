import fs from "node:fs";
import path from "node:path";
import { loadDb, type Db } from "./db";
import type { Observation } from "./schema";

/**
 * Cross-record rules that zod cannot see, because zod validates one file at a
 * time. These are the constraints the site's claims actually rest on: every
 * reference resolves, every fact has a source, and no two numbers sit in the
 * same table unless they were produced by the same protocol.
 *
 * Errors fail the build. Warnings are printed and tolerated.
 */

export interface Issue {
  level: "error" | "warn";
  where: string;
  message: string;
}

const CONTENT_DIR = path.resolve(process.cwd(), "content");

function contentSlugs(sub: string): string[] {
  const dir = path.join(CONTENT_DIR, sub);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx?$/, ""));
}

export function checkIntegrity(db: Db = loadDb()): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: "error", where, message });
  const warn = (where: string, message: string) => issues.push({ level: "warn", where, message });

  const capIds = new Set(db.capabilities.map((c) => c.id));
  const metricIds = new Set(db.metrics.map((m) => m.id));
  const agentIds = new Set(db.agents.map((a) => a.id));
  const packageIds = new Set(db.packages.map((p) => p.id));
  const toolIds = new Set(db.tools.map((t) => t.id));
  const postSlugs = new Set(contentSlugs("posts"));

  /* -- routing: /tools/<capability> and /tools/<owner>/<name> share a prefix,
        so a capability slug that equals an owner slug would make one of the two
        unreachable. ---------------------------------------------------------- */
  const ownerIds = new Set(db.tools.map((t) => t.owner.id));
  for (const id of capIds) {
    if (ownerIds.has(id)) {
      err(
        `capabilities.yaml#${id}`,
        `capability slug collides with a tool owner slug; /tools/${id} is ambiguous`,
      );
    }
  }

  /* -- observation key registry ------------------------------------------- */
  const seenKeys = new Set<string>();
  for (const key of db.observationKeys) {
    if (seenKeys.has(key.key)) err("observation-keys.yaml", `duplicate key "${key.key}"`);
    seenKeys.add(key.key);
    if (key.capability && !capIds.has(key.capability)) {
      err(`observation-keys.yaml#${key.key}`, `unknown capability "${key.capability}"`);
    }
    if (key.class === "invariant" && !key.holds_when) {
      err(
        `observation-keys.yaml#${key.key}`,
        `an invariant must declare holds_when, otherwise pass/fail cannot be rendered`,
      );
    }
    if (key.type === "enum" && (!key.values || key.values.length === 0)) {
      warn(`observation-keys.yaml#${key.key}`, `enum key declares no values`);
    }
    if (key.applies_to !== "both" && !db.capability(key.capability ?? "")?.split) {
      err(
        `observation-keys.yaml#${key.key}`,
        `applies_to "${key.applies_to}" but capability "${key.capability ?? "(none)"}" declares no split, so the key would never render`,
      );
    }
  }

  /* -- capability split ----------------------------------------------------
        The split decides which comparison table a tool lands in, so its key
        has to exist and has to belong to the capability doing the splitting;
        otherwise every tool falls through and the page silently loses its
        comparison entirely. --------------------------------------------- */
  for (const cap of db.capabilities) {
    if (!cap.split) continue;
    const where = `capabilities.yaml#${cap.id}`;
    const key = db.observationKey(cap.split.key);
    if (!key) {
      err(where, `split key "${cap.split.key}" is not registered in observation-keys.yaml`);
      continue;
    }
    if (key.capability !== cap.id) {
      err(where, `split key "${cap.split.key}" belongs to capability "${key.capability ?? "(none)"}"`);
    }
    if (key.applies_to !== "both") {
      err(where, `split key "${cap.split.key}" must apply to both parts; it decides which part a tool is in`);
    }
    if (key.type === "enum" && key.values) {
      const matched = new Set(cap.split.parts.flatMap((p) => p.match));
      for (const v of key.values) {
        if (!matched.has(v)) {
          warn(where, `split key value "${v}" is matched by no part, so such a tool would be in no table`);
        }
      }
      for (const v of matched) {
        if (!key.values.includes(v)) {
          err(where, `split matches "${v}", which is not a declared value of "${cap.split.key}"`);
        }
      }
    }
  }

  const checkObservations = (
    where: string,
    observations: Observation[],
    opts: { capabilities?: string[]; hasParentSource: boolean },
  ) => {
    const seen = new Set<string>();
    for (const o of observations) {
      const key = db.observationKey(o.key);
      if (!key) {
        err(where, `observation key "${o.key}" is not registered in observation-keys.yaml`);
        continue;
      }
      if (seen.has(o.key)) err(where, `duplicate observation "${o.key}"`);
      seen.add(o.key);

      if (key.capability && opts.capabilities && !opts.capabilities.includes(key.capability)) {
        err(
          where,
          `observation "${o.key}" belongs to capability "${key.capability}", which this subject does not have`,
        );
      }
      if (o.status === "ok" && key.type === "enum" && key.values && key.values.length > 0) {
        const v = String(o.value);
        if (!key.values.includes(v)) {
          warn(where, `observation "${o.key}" value "${v}" is outside the declared values for that key`);
        }
      }
      if (o.status === "ok" && key.type === "boolean") {
        const v = String(o.value);
        if (v !== "true" && v !== "false") {
          err(where, `observation "${o.key}" is a boolean key but its value is "${v}"`);
        }
      }
      // Every asserted fact must be traceable, either through its own link or
      // through the subject's source. This is the rule the whole site rests on.
      if (o.status === "ok" && !o.source_url && !opts.hasParentSource) {
        err(where, `observation "${o.key}" asserts a value with no source_url and no source on the subject`);
      }
    }
  };

  /* -- tools ---------------------------------------------------------------- */
  for (const tool of db.tools) {
    const where = `tools/${tool.id}.yaml`;
    if (!db.owner(tool.owner)) {
      err(where, `owner ${tool.owner.type} "${tool.owner.id}" does not exist`);
    }
    for (const c of tool.capabilities) {
      if (!capIds.has(c.id)) err(where, `unknown capability "${c.id}"`);
    }
    if (tool.schema_file) {
      const p = path.join(process.cwd(), "data", "tools", tool.owner.id, tool.schema_file);
      if (!fs.existsSync(p)) err(where, `schema_file "${tool.schema_file}" does not exist`);
    }
    // A source URL without a commit points at a moving target: the line it
    // referred to may not say that any more. Not fatal, but it is real debt and
    // it should stay visible rather than quietly accumulating.
    if (tool.source && !tool.source.commit && tool.observations.length > 0) {
      warn(where, `source has no commit, so its observations cannot be re-checked against a fixed revision`);
    }
    checkObservations(where, tool.observations, {
      capabilities: tool.capabilities.map((c) => c.id),
      hasParentSource: Boolean(tool.source),
    });
  }

  /* -- agents and packages -------------------------------------------------- */
  for (const agent of db.agents) {
    const where = `agents/${agent.id}.yaml`;
    for (const ad of agent.adoption) {
      if (!packageIds.has(ad.package)) err(where, `adoption references unknown package "${ad.package}"`);
    }
    checkObservations(where, agent.observations, { hasParentSource: Boolean(agent.repo) });
    if (agent.source_available && !agent.repo) {
      warn(where, `source_available is true but no repo is recorded`);
    }
  }
  for (const pkg of db.packages) {
    checkObservations(`packages/${pkg.id}.yaml`, pkg.observations, {
      hasParentSource: Boolean(pkg.repo),
    });
  }

  /* -- benchmarks ----------------------------------------------------------- */
  for (const b of db.benchmarks) {
    const where = `benchmarks/${b.id}.yaml`;
    if (!capIds.has(b.capability)) err(where, `unknown capability "${b.capability}"`);
    const versions = new Set<string>();
    for (const v of b.versions) {
      if (versions.has(v.version)) err(where, `duplicate version "${v.version}"`);
      versions.add(v.version);
      for (const m of v.emits) {
        if (!metricIds.has(m)) err(where, `${v.version} emits unknown metric "${m}"`);
      }
      if (v.post && !postSlugs.has(v.post)) {
        err(where, `${v.version} points at post "${v.post}", which does not exist`);
      }
      if (!v.post) {
        warn(where, `${v.version} has no post; its protocol has no published methodology page`);
      }
    }
  }

  /* -- runs and measurements ------------------------------------------------ */
  const runIds = new Set<string>();
  // (benchmark, metric) -> versions that have produced numbers
  const versionsPerMetric = new Map<string, Set<string>>();

  for (const run of db.runs) {
    const where = `runs/${run.id}.yaml`;
    if (runIds.has(run.id)) err(where, `duplicate run id "${run.id}"`);
    runIds.add(run.id);

    const benchmark = db.benchmark(run.benchmark);
    if (!benchmark) {
      err(where, `unknown benchmark "${run.benchmark}"`);
      continue;
    }
    const version = benchmark.versions.find((v) => v.version === run.benchmark_version);
    if (!version) {
      err(where, `benchmark "${run.benchmark}" never declared version "${run.benchmark_version}"`);
      continue;
    }
    if (run.post && !postSlugs.has(run.post)) {
      err(where, `points at post "${run.post}", which does not exist`);
    }
    if (!run.draft && !run.post && !run.notes) {
      err(where, `a published run needs either a post or notes, so its numbers stay traceable`);
    }
    if (run.environment && Object.keys(run.environment).length === 0 && !run.draft) {
      warn(where, `no environment recorded; anything that moves the numbers should be listed`);
    }

    for (const m of run.measurements) {
      const label = `${where} [${m.subject.type}:${m.subject.id}/${m.metric}]`;
      if (!metricIds.has(m.metric)) err(label, `unknown metric "${m.metric}"`);
      if (!version.emits.includes(m.metric)) {
        err(label, `metric "${m.metric}" is not in ${run.benchmark_version}'s emits`);
      }
      const exists =
        m.subject.type === "tool"
          ? toolIds.has(m.subject.id)
          : m.subject.type === "agent"
            ? agentIds.has(m.subject.id)
            : packageIds.has(m.subject.id);
      if (!exists) err(label, `subject ${m.subject.type} "${m.subject.id}" does not exist`);
      if (m.status === "ok" && m.value === undefined && m.value_num === undefined) {
        err(label, `status is ok but no value was recorded`);
      }
      if (m.status === "ok" && !m.subject_version && !run.draft) {
        warn(label, `no subject_version; this number cannot be interpreted once the subject changes`);
      }
      if (m.status !== "ok" && !m.note) {
        warn(label, `status "${m.status}" with no note; a failure is a finding and should say what happened`);
      }

      const mapKey = `${run.benchmark}/${m.metric}`;
      if (!versionsPerMetric.has(mapKey)) versionsPerMetric.set(mapKey, new Set());
      versionsPerMetric.get(mapKey)!.add(run.benchmark_version);
    }
  }

  // The comparability rule: two measurements may be compared only if metric AND
  // benchmark_version match. We cannot know here which page will put them side
  // by side, so flag the ambiguity and let the render layer annotate it.
  for (const [mapKey, versions] of versionsPerMetric) {
    if (versions.size > 1) {
      warn(
        `runs/*`,
        `metric "${mapKey}" has numbers under ${[...versions].sort().join(" and ")}; any table showing both must mark the protocols as different`,
      );
    }
  }

  /* -- editorial layer ------------------------------------------------------ */
  for (const slug of contentSlugs("capabilities")) {
    if (!capIds.has(slug)) {
      err(`content/capabilities/${slug}.md`, `no capability with id "${slug}"`);
    }
  }
  for (const cap of db.capabilities) {
    if (db.toolsByCapability(cap.id).length === 0) {
      warn(`capabilities.yaml#${cap.id}`, `no tools carry this capability; the comparison page would be empty`);
    }
  }

  /* -- homepage cards ------------------------------------------------------- */
  db.featured.forEach((card, i) => {
    const where = `featured.yaml[${i}]`;
    const v = card.visual;
    if (v.type === "bars") {
      const run = db.run(v.run);
      if (!run) err(where, `unknown run "${v.run}"`);
      if (!metricIds.has(v.metric)) err(where, `unknown metric "${v.metric}"`);
      if (run && !run.measurements.some((m) => m.metric === v.metric)) {
        err(where, `run "${v.run}" holds no measurements for metric "${v.metric}"`);
      }
    }
    if (v.type === "observation-lines" || v.type === "ratio") {
      if (!capIds.has(v.capability)) err(where, `unknown capability "${v.capability}"`);
      if (!db.observationKey(v.key)) err(where, `unregistered observation key "${v.key}"`);
    }
  });

  return issues;
}

export function formatIssues(issues: Issue[]): string {
  return issues
    .map((i) => `${i.level === "error" ? "ERROR" : " WARN"}  ${i.where}\n        ${i.message}`)
    .join("\n");
}
