#!/usr/bin/env tsx
/**
 * Loads every record under data/, validates field shapes, then runs the
 * cross-record rules. Wired into `npm run build`, so a broken reference or an
 * unsourced fact cannot reach the site.
 */
import { loadDb, DataError } from "../src/lib/db";
import { checkIntegrity, formatIssues } from "../src/lib/integrity";

function main() {
  let db;
  try {
    db = loadDb();
  } catch (err) {
    if (err instanceof DataError) {
      console.error(`\n${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const issues = checkIntegrity(db);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warn");

  const counts = [
    `${db.capabilities.length} capabilities`,
    `${db.agents.length} agents`,
    `${db.packages.length} packages`,
    `${db.tools.length} tools`,
    `${db.observationKeys.length} observation keys`,
    `${db.tools.reduce((n, t) => n + t.observations.length, 0)} observations`,
    `${db.benchmarks.length} benchmarks`,
    `${db.runs.length} runs`,
    `${db.runs.reduce((n, r) => n + r.measurements.length, 0)} measurements`,
  ].join(" · ");

  console.log(`\n  ${counts}\n`);

  if (issues.length > 0) {
    console.log(formatIssues(issues));
    console.log("");
  }

  if (errors.length > 0) {
    console.error(`  ${errors.length} error(s), ${warnings.length} warning(s) — build blocked\n`);
    process.exit(1);
  }
  console.log(`  ok — ${warnings.length} warning(s)\n`);
}

main();
