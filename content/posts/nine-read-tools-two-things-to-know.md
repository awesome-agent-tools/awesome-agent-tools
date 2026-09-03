---
title: Nine read tools, two things you actually need to know
lede: >-
  Six of nine coding agents will let you overwrite an edit that landed after the
  file was read. One counts lines from zero. Neither is visible from the outside
  until it costs you something.
date: 2026-09-02
kind: comparison
---

We read the file-reading tool of nine coding agents out of their source: Claude
Code, Codex, pi, opencode, Hermes, Kimi Code, dsh, Qwen Code and MiMo Code. Not
the docs — the implementations.

Most of what turned up is trivia. Line caps sit at 2000 almost everywhere (Kimi
Code uses 1000). Byte caps cluster at 50 KB. Output wrappers differ in ways that
change nothing. If you were hoping the differences would be dramatic, they are
mostly not.

Two of them matter.

## Six of nine can silently lose an edit

The sequence: the agent reads a file. It thinks, or calls another tool, or waits
on you. Meanwhile the file changes — you edited it, a formatter ran, a rebase
landed. The agent then writes back the version it read. The intervening change
is gone, with no error and nothing in the transcript to indicate anything
happened.

Three implementations prevent this, each in a different place:

| Agent | Guard |
|---|---|
| Claude Code | An edit is rejected unless the file was read first |
| Hermes | Compares mtime at write time |
| MiMo Code | Tracks read state per file |

The other six — Codex, pi, opencode, Kimi Code, dsh, Qwen Code — have nothing
in the read/write path that notices.

Three teams solving the same problem independently, in three different places,
is usually a sign the problem is real rather than theoretical. We are treating
this as an **invariant**: something every implementation should hold to, and
therefore something we are willing to mark as pass or fail. There is no good
argument for silently discarding a concurrent edit.

## One tool in nine counts from zero

Qwen Code's `read_file` is 0-indexed. Every other implementation that answers
the question starts at line one. Codex does not answer it, because Codex has no
read tool at all — it shells out to `cat` and `sed`.

This one is **not** a defect, and we want to be explicit about that, because the
tempting move is to put a red X next to it. It is a design choice. Both bases
are defensible. The problem is not the choice, it is that nothing surfaces it:
a builder moving code between harnesses finds out when every read is off by
exactly one line, and neither tool's description mentions the base.

That distinction — invariant versus design choice — is the line we are trying to
hold across this whole site. Differing from everyone else is not the same as
being wrong. Losing data is wrong regardless of intent.

## Also true, and less important

**Four line-number formats.** `N + TAB` (Claude Code, Kimi Code), `N: `
(opencode, MiMo Code), `N|` (Hermes), and none at all (Codex, pi). Two harnesses
have written code specifically to stop the model writing that prefix back into
your file: Claude Code instructs the model to strip it, Hermes runs a detector
on the write path that rejects content matching `N|`. Same pothole, two
patches — and neither team has any data on how often a model actually falls in.

**Hermes budgets characters, not lines.** 100k characters rather than a line
cap, with a comment in the source explaining why: line caps are meaningless for
log files, wide CSVs, and minified code. It is the only implementation surveyed
that made this argument explicitly, and it is a good one.

**Codex puts raw binary into your context.** Because it reads through the shell,
`cat` on a binary file returns bytes straight into the context window — nothing
marks them as binary, nothing truncates, nothing warns. Every implementation
with a dedicated read tool either refuses or errors. This is the second
invariant on the page, and Codex is the only one that fails it.

## What we could not check

Four more harnesses register a read tool we could not verify from source:
OpenHands (`file_editor` view mode), OpenClaw (`read`), Grok Build (`read_file`;
its global tool caps are documented as 40 KB / 20k chars), and ZCode (`Read`, no
public repo reachable). They are absent from the counts above rather than
counted as absent — "we did not check" and "it does not do this" are different
claims, and conflating them is how comparison sites become untrustworthy.

---

The living version of this comparison, with every cell linked to where it was
read, is at [/tools/read](/tools/read). The figures in this post are frozen as
published on 2 September 2026; the capability page keeps moving as the
implementations do.
