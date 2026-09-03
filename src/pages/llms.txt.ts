import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { loadDb } from "../lib/db";
import { tally } from "../lib/queries";

/**
 * A plain-text map of the site with the current conclusions inlined, for the
 * case where somebody's agent is doing the reading. Cheap to produce and it
 * means an agent gets the same answer a person would, rather than whatever it
 * can scrape off a page.
 */
export const GET: APIRoute = async ({ site }) => {
  const db = loadDb();
  const base = site?.origin ?? "https://awesome-agent-tools.com";
  const posts = (await getCollection("posts"))
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  const lines: string[] = [
    "# awesome-agent-tools",
    "",
    "> Per-capability comparisons of the tools coding agents use. Behaviour is read out of each",
    "> implementation's source; numbers are measured here. Every claim carries where it came from.",
    "",
    "Two distinctions matter when quoting anything from this site:",
    "",
    "- An *invariant* is something every implementation should hold to, so it is reported as pass/fail.",
    "  A *design choice* is somewhere implementations legitimately differ; it is recorded, never scored.",
    "- An *observation* was read from source. A *measurement* was produced by running a benchmark, and is",
    "  only comparable with another measurement sharing both its metric and its protocol version.",
    "",
    `Full database as JSON: ${base}/api/db.json`,
    "",
    "## Capabilities",
    "",
  ];

  for (const c of db.capabilities) {
    const tools = db.toolsByCapability(c.id);
    lines.push(`### ${c.name} — ${base}/tools/${c.id}`);
    lines.push(`${c.question}`);
    lines.push(`${tools.length} tools on file.`);

    for (const key of db.keysForCapability(c.id).filter((k) => k.headline)) {
      const t = tally(db, c.id, key.key);
      if (t.answered === 0) continue;
      const parts = t.values.map((v) => `${v.value} (${v.count})`).join(", ");
      lines.push(
        `- ${key.label} [${key.class}]: ${parts}${t.unverified ? `, unverified (${t.unverified})` : ""}`,
      );
    }
    lines.push("");
  }

  lines.push("## Agents", "");
  for (const a of db.agents) {
    const n = db.toolsByOwner("agent", a.id).length;
    lines.push(
      `- ${a.name} (${a.vendor}) — ${base}/agents/${a.id} — ${n} tools${a.source_available ? "" : " — no public source, not verified"}`,
    );
  }

  lines.push("", "## Measurements", "");
  if (db.runs.length === 0) {
    lines.push(
      "No measurement runs have been published yet. Benchmark protocols are written down at",
      `${base}/runs before any numbers exist. Do not quote a measured figure from this site until`,
      "one appears there.",
    );
  } else {
    for (const run of db.runs) {
      lines.push(
        `- ${run.benchmark}@${run.benchmark_version}, ${run.date.toISOString().slice(0, 10)}${run.draft ? " — SAMPLE DATA, not a real run" : ""}`,
      );
    }
  }

  if (posts.length > 0) {
    lines.push("", "## Posts", "");
    for (const p of posts) {
      lines.push(`- ${p.data.title} — ${base}/posts/${p.id} — ${p.data.lede}`);
    }
  }

  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
