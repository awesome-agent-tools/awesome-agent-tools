import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * The editorial layer. Everything factual lives in `data/` and is loaded by
 * src/lib/db.ts; these two collections hold the writing that sits on top of it.
 *
 * The split is the point. A capability page's prose is maintained forever and
 * its numbers follow the database. A post is a snapshot: it copies the numbers
 * it cites and freezes them, so that six months from now it does not contradict
 * itself by half-updating.
 */

const capabilities = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/capabilities" }),
  schema: z.object({
    /** Present → the page renders as a buying guide with a recommendation.
     *  Absent → the verdict block does not render at all and the page is a
     *  plain comparison. One template, two shapes; see product.md §7. */
    pick: z
      .object({
        tool: z.string(),
        label: z.string().default("Generally"),
        reason: z.string(),
      })
      .optional(),
    /** Cases where the pick is the wrong answer. Only meaningful with a pick. */
    switch_when: z
      .array(z.object({ situation: z.string(), then: z.string(), href: z.string().optional() }))
      .default([]),
    /**
     * Numbers worth pulling to the top of the page. Prefer `derive` over a
     * literal `value`: a capability page is maintained, not a snapshot, so a
     * hand-typed figure here goes stale the moment the database moves and the
     * page starts contradicting the table below it. Literals are for numbers
     * the database genuinely cannot produce.
     */
    kpi: z
      .array(
        z
          .object({
            value: z.string().optional(),
            derive: z
              .discriminatedUnion("as", [
                // "6/9" — how many implementations recorded this value.
                z.object({ as: z.literal("ratio"), key: z.string(), counts: z.string() }),
                // "4" — how many distinct values were recorded.
                z.object({ as: z.literal("distinct"), key: z.string() }),
              ])
              .optional(),
            label: z.string(),
            sub: z.string().optional(),
          })
          .refine((k) => Boolean(k.value) !== Boolean(k.derive), {
            message: "a kpi needs exactly one of value or derive",
          }),
      )
      .default([]),
    updated: z.coerce.date(),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/posts" }),
  schema: z.object({
    title: z.string(),
    /** Standfirst. Should carry the finding on its own — a reader who stops
     *  here has the right answer, just not the evidence. */
    lede: z.string(),
    date: z.coerce.date(),
    kind: z.enum(["new-number", "comparison", "ecosystem-change"]),
    /** Set when this post publishes a benchmark protocol. That makes the post
     *  the methodology page; there is no separate /methods route. */
    benchmark: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { capabilities, posts };
