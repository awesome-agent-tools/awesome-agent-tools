import type { Db, ToolRecord } from "./db";
import type { Observation, ObservationKey } from "./schema";

/** Derived views over the database. Kept apart from db.ts so that loading and
 *  interpreting stay separable — everything here is opinion built on facts. */

export interface ObservationRow {
  tool: ToolRecord;
  observation: Observation | undefined;
}

/** One row per tool that carries the capability, ordered by owner name. The
 *  row unit is the owner: `claude-code/read` is a stable anchor an outside
 *  page can link to. */
export function rowsFor(db: Db, capabilityId: string, key: string): ObservationRow[] {
  return db.toolsByCapability(capabilityId).map((tool) => ({
    tool,
    observation: tool.observations.find((o) => o.key === key),
  }));
}

export interface Tally {
  /** Distinct recorded values, most common first. */
  values: { value: string; count: number; tools: ToolRecord[] }[];
  /** Tools with a confirmed value — the denominator for any "N of M" claim. */
  answered: number;
  /** Tools carrying the capability at all. */
  total: number;
  unverified: number;
  notApplicable: number;
}

export function tally(db: Db, capabilityId: string, key: string): Tally {
  const rows = rowsFor(db, capabilityId, key);
  const byValue = new Map<string, ToolRecord[]>();
  let unverified = 0;
  let notApplicable = 0;

  for (const { tool, observation } of rows) {
    if (!observation) {
      notApplicable++;
      continue;
    }
    if (observation.status === "unverified") {
      unverified++;
      continue;
    }
    if (observation.status === "not-applicable") {
      notApplicable++;
      continue;
    }
    const v = String(observation.value);
    if (!byValue.has(v)) byValue.set(v, []);
    byValue.get(v)!.push(tool);
  }

  const values = [...byValue.entries()]
    .map(([value, tools]) => ({ value, count: tools.length, tools }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  return {
    values,
    answered: values.reduce((n, v) => n + v.count, 0),
    total: rows.length,
    unverified,
    notApplicable,
  };
}

export interface Divergence {
  key: ObservationKey;
  mine: string;
  note?: string;
  /** The value most other implementations chose, and how many chose it. */
  majority: string;
  majorityCount: number;
  peers: number;
}

/**
 * What this tool does differently from most implementations of the same
 * capability. The most useful block on a tool page, and it has to be derived
 * rather than written, or it goes stale the moment a peer changes.
 *
 * Deliberately conservative: with fewer than four peers answering, "most" is
 * not a claim worth making, and nothing is reported.
 */
export function divergences(db: Db, tool: ToolRecord): Divergence[] {
  const out: Divergence[] = [];
  const seen = new Set<string>();

  for (const cap of tool.capabilities) {
    const peers = db.toolsByCapability(cap.id).filter((t) => t.id !== tool.id);

    for (const observation of tool.observations) {
      if (observation.status !== "ok" || seen.has(observation.key)) continue;
      const key = db.observationKey(observation.key);
      if (!key || key.capability !== cap.id || !key.divergence) continue;

      const peerValues = peers
        .map((p) => p.observations.find((o) => o.key === observation.key))
        .filter((o): o is Observation => Boolean(o) && o!.status === "ok")
        .map((o) => String(o.value));

      if (peerValues.length < 4) continue;

      const counts = new Map<string, number>();
      for (const v of peerValues) counts.set(v, (counts.get(v) ?? 0) + 1);
      const [majority, majorityCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

      const mine = String(observation.value);
      if (mine === majority) continue;
      // "Most implementations" needs a strict majority behind it. Two out of
      // four agreeing is not a convention this tool is departing from, it is
      // four implementations that all disagree.
      if (majorityCount * 2 <= peerValues.length) continue;

      seen.add(observation.key);
      out.push({
        key,
        mine,
        note: observation.note,
        majority,
        majorityCount,
        peers: peerValues.length,
      });
    }
  }

  return out.sort(
    (a, b) =>
      Number(b.key.headline) - Number(a.key.headline) ||
      a.key.order - b.key.order ||
      a.key.label.localeCompare(b.key.label),
  );
}

/** Groups a capability's observation keys into the sections the comparison
 *  table renders. Order comes from the registry, never from the template.
 *
 *  `appliesTo` narrows to one half of a two-job capability: passing "content"
 *  keeps the keys marked `content` and the ones marked `both`, and drops the
 *  `name`-only ones. Omitting it keeps everything, which is what a single-job
 *  capability like read wants. */
export function groupedKeys(
  db: Db,
  capabilityId: string,
  appliesTo?: "name" | "content",
): { group: string; keys: ObservationKey[] }[] {
  const keys = db
    .keysForCapability(capabilityId)
    .filter((k) => !appliesTo || k.applies_to === "both" || k.applies_to === appliesTo);
  const groups: { group: string; keys: ObservationKey[] }[] = [];
  for (const key of keys) {
    let g = groups.find((x) => x.group === key.group);
    if (!g) {
      g = { group: key.group, keys: [] };
      groups.push(g);
    }
    g.keys.push(key);
  }
  return groups;
}

/** How a raw recorded value should read on screen. Booleans on an invariant are
 *  the only case that changes: "false" means the invariant fails, and saying so
 *  is clearer than making the reader remember which way round the key runs. */
export function displayValue(key: ObservationKey, raw: string): string {
  if (key.class !== "invariant" || key.type !== "boolean") return raw;
  return raw === key.holds_when ? "holds" : "fails";
}

/** Whether an invariant holds for a given observation. Returns null when the
 *  question does not apply — an unverified or n/a cell is not a failure. */
export function invariantHolds(key: ObservationKey, observation?: Observation): boolean | null {
  if (key.class !== "invariant") return null;
  if (!observation || observation.status !== "ok") return null;
  return String(observation.value) === key.holds_when;
}

export interface PeerContext {
  /** Implementations recording this tool's value, this tool included. 0 when
   *  this tool recorded nothing. */
  agree: number;
  /** Implementations that recorded any value. The denominator for "N of M". */
  answered: number;
  /** Implementations that looked and could not tell. Never folded into
   *  `answered` — not knowing is a different claim from not doing. */
  unverified: number;
  /** What the others said instead, most common first. */
  others: { value: string; count: number }[];
  /** This tool is the only one recording its value. */
  alone: boolean;
}

/**
 * How every implementation of the capability answered the same question. A
 * value on its own is a fact sheet; a value next to what the others chose is a
 * comparison, which is the only thing here a link list could not do.
 *
 * Counts are inclusive of the tool being viewed. That matters for more than
 * arithmetic: the launch post and the homepage cards say "six of nine", and a
 * tool page quietly saying "five of eight others" about the same fact would
 * look like a contradiction to anyone reading both.
 *
 * Returns null when nobody answered — "0 of 0" is noise dressed as a finding.
 */
export function peerContext(
  db: Db,
  capabilityId: string,
  key: string,
  observation?: Observation,
): PeerContext | null {
  const t = tally(db, capabilityId, key);
  if (t.answered === 0) return null;

  const mine = observation?.status === "ok" ? String(observation.value) : null;
  const agree = mine === null ? 0 : (t.values.find((v) => v.value === mine)?.count ?? 0);
  const others = t.values.filter((v) => v.value !== mine).map(({ value, count }) => ({ value, count }));

  return { agree, answered: t.answered, unverified: t.unverified, others, alone: agree === 1 };
}
