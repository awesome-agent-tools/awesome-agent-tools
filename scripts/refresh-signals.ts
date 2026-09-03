#!/usr/bin/env tsx
/**
 * Refreshes the cheap signals — stars, last commit — on agents and packages.
 *
 * Cheap signals are not the point of this site, but they decide where the
 * expensive work goes: you do not measure fifty browser tools, you use cheap
 * signals to narrow to four and measure those. So they need to be current, and
 * they need a timestamp saying how current.
 *
 * Star counts are deliberately the weakest thing recorded here. The ordering
 * that matters is: shipped-by-a-harness > downloads > release cadence >
 * "the model keeps picking the wrong tool" issues > stars. A signal is worth
 * what it cost the person emitting it, and a star costs nothing.
 *
 *   GITHUB_TOKEN=... npx tsx scripts/refresh-signals.ts
 *
 * Runs unauthenticated too, at 60 requests/hour.
 */
import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";

const DATA = path.resolve(process.cwd(), "data");
const token = process.env.GITHUB_TOKEN;

interface RepoStats {
  stars: number;
  lastCommit: string | null;
  license: string | null;
  language: string | null;
}

async function fetchRepo(repoUrl: string): Promise<RepoStats | null> {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!m) return null;
  const [, owner, name] = m;

  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "awesome-agent-tools-refresh",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers });
  if (!res.ok) {
    console.warn(`  ! ${owner}/${name}: ${res.status} ${res.statusText}`);
    return null;
  }
  const json = (await res.json()) as {
    stargazers_count: number;
    pushed_at: string;
    license: { spdx_id: string } | null;
    language: string | null;
  };
  return {
    stars: json.stargazers_count,
    lastCommit: json.pushed_at ? json.pushed_at.slice(0, 10) : null,
    license: json.license?.spdx_id ?? null,
    language: json.language,
  };
}

async function refreshDir(sub: string) {
  const dir = path.join(DATA, sub);
  if (!fs.existsSync(dir)) return;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    const full = path.join(dir, file);
    // parseDocument rather than parse: these files carry comments explaining
    // why a value is what it is, and a refresh must not eat them.
    const doc = parseDocument(fs.readFileSync(full, "utf8"));
    const repo = doc.get("repo");
    if (typeof repo !== "string") continue;

    const stats = await fetchRepo(repo);
    if (!stats) continue;

    doc.set("stars", stats.stars);
    if (stats.lastCommit) doc.set("last_commit", stats.lastCommit);
    if (stats.license && !doc.get("license")) doc.set("license", stats.license);
    if (stats.language && !doc.get("language")) doc.set("language", stats.language);
    doc.set("signals_checked_at", new Date().toISOString().slice(0, 10));

    fs.writeFileSync(full, doc.toString({ lineWidth: 96 }));
    console.log(`  ${sub}/${file}: ${stats.stars} stars, pushed ${stats.lastCommit}`);

    // Stay well inside the unauthenticated rate limit.
    if (!token) await new Promise((r) => setTimeout(r, 1200));
  }
}

async function main() {
  if (!token) console.log("\n  no GITHUB_TOKEN — running unauthenticated (60 req/hour)\n");
  await refreshDir("agents");
  await refreshDir("packages");
  console.log("\n  done\n");
}

main();
