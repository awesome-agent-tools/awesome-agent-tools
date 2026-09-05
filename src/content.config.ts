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

/**
 * A figure the build computes from `data/` rather than one typed in here.
 * Shared by `headline` and `kpi` because both make the same promise: the number
 * shown is the number the tables below it would produce. Resolved by
 * `deriveFigure` in src/lib/queries.ts.
 */
const derived = z.discriminatedUnion("as", [
  // "6/9" — how many implementations recorded this value.
  z.object({ as: z.literal("ratio"), key: z.string(), counts: z.string() }),
  // "4" — how many distinct values were recorded.
  z.object({ as: z.literal("distinct"), key: z.string() }),
]);

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
     * The single finding this capability's row carries on /capabilities.
     * Optional, and most capabilities will not have one: without it the index
     * falls back to what it can derive structurally — how many harnesses ship a
     * tool, how much of it has been read from source. That fallback is the
     * common path, not a degraded one.
     *
     * Deliberately not "the first kpi". Which figure belongs at the top of the
     * page and which one summarises the capability from outside are different
     * editorial questions: read's leading kpi is its line-number formats, which
     * its own prose files under the long tail.
     */
    headline: z
      .object({
        value: z.string().optional(),
        derive: derived.optional(),
        /** Reads directly after the figure, so it starts mid-sentence:
         *  "6/9 · will let an agent overwrite a file that changed…" */
        text: z.string(),
      })
      .refine((h) => Boolean(h.value) !== Boolean(h.derive), {
        message: "a headline needs exactly one of value or derive",
      })
      .optional(),
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
            derive: derived.optional(),
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
