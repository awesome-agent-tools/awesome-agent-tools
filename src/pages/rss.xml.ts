import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = (await getCollection("posts"))
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: "awesome-agent-tools",
    description:
      "What agent tools actually do — read from source, measured here, every claim carrying its source.",
    site: context.site ?? "https://awesome-agent-tools.com",
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.lede,
      pubDate: post.data.date,
      link: `/posts/${post.id}`,
    })),
  });
}
