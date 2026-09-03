import type { APIRoute } from "astro";
import { loadDb } from "../../../lib/db";
import { tally } from "../../../lib/queries";

/** One capability with every tool that carries it, its recorded observations,
 *  and the tally per dimension — enough to answer a comparison question without
 *  rendering the page. */
export function getStaticPaths() {
  const db = loadDb();
  return db.capabilities.map((c) => ({ params: { capability: c.id }, props: { id: c.id } }));
}

export const GET: APIRoute = ({ props }) => {
  const db = loadDb();
  const id = (props as { id: string }).id;
  const capability = db.capability(id)!;
  const keys = db.keysForCapability(id);

  const body = {
    ...capability,
    url: `/tools/${id}`,
    dimensions: keys.map((k) => ({
      ...k,
      distribution: tally(db, id, k.key).values.map((v) => ({
        value: v.value,
        count: v.count,
        tools: v.tools.map((t) => t.id),
      })),
    })),
    tools: db.toolsByCapability(id).map((t) => ({
      id: t.id,
      url: t.href,
      exposed_name: t.exposed_name,
      owner: t.owner,
      role: t.capabilities.find((c) => c.id === id)?.role,
      via: t.via,
      source: t.source,
      observations: t.observations.filter((o) => db.observationKey(o.key)?.capability === id),
      notes: t.notes,
    })),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
