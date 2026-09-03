import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { loadDb } from "../lib/db";

/** Feeds the homepage filter. Kept small and flat: the search box is a
 *  shortcut to a page, not a search product. Everything it can reach is also
 *  reachable by following links with JavaScript off. */
export const GET: APIRoute = async () => {
  const db = loadDb();
  const posts = (await getCollection("posts")).filter((p) => !p.data.draft);

  const entries = [
    ...db.capabilities.map((c) => ({
      name: c.name,
      sub: c.question,
      kind: "capability",
      href: `/tools/${c.id}`,
    })),
    ...db.agents.map((a) => ({
      name: a.name,
      sub: a.vendor,
      kind: "agent",
      href: `/agents/${a.id}`,
    })),
    ...db.packages.map((p) => ({
      name: p.name,
      sub: p.vendor ?? p.kind,
      kind: "package",
      href: `/packages/${p.id}`,
    })),
    ...db.tools.map((t) => ({
      name: t.exposed_name,
      sub: t.ownerRef.name,
      kind: "tool",
      href: t.href,
    })),
    ...posts.map((p) => ({
      name: p.data.title,
      sub: p.data.lede.slice(0, 90),
      kind: "post",
      href: `/posts/${p.id}`,
    })),
  ];

  return new Response(JSON.stringify(entries), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
