import type { APIRoute } from "astro";
import { loadDb } from "../../lib/db";

/**
 * The whole database as one document.
 *
 * Agents are a real channel for this site — people already ask their agent to
 * research a choice for them — so the data is served in a form that does not
 * require parsing a page. Nothing here is behind JavaScript or an image.
 */
export const GET: APIRoute = () => {
  const db = loadDb();

  const body = {
    generated_at: new Date().toISOString(),
    license: "CC BY 4.0",
    source: "https://github.com/awesome-agent-tools/awesome-agent-tools",
    note: "Every observation carries where it was read from. An observation with status 'unverified' was not confirmed; 'not-applicable' means the question does not apply to that implementation.",
    capabilities: db.capabilities,
    observation_keys: db.observationKeys,
    metrics: db.metrics,
    agents: db.agents.map((a) => ({
      ...a,
      url: `/agents/${a.id}`,
      tools: db.toolsByOwner("agent", a.id).map((t) => t.id),
    })),
    packages: db.packages.map((p) => ({
      ...p,
      url: `/packages/${p.id}`,
      tools: db.toolsByOwner("package", p.id).map((t) => t.id),
    })),
    tools: db.tools.map((t) => ({
      id: t.id,
      url: t.href,
      exposed_name: t.exposed_name,
      owner: t.owner,
      capabilities: t.capabilities,
      via: t.via,
      description_text: t.description_text,
      source: t.source,
      observations: t.observations,
      notes: t.notes,
    })),
    benchmarks: db.benchmarks,
    runs: db.runs,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
