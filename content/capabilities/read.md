---
# No `pick` here on purpose. Nobody chooses a read tool — it arrives with the
# harness — so a recommendation would be answering a question no one is asking.
# Without a pick the verdict block does not render and this page is a reference.
updated: 2026-09-02
kpi:
  - derive: { as: distinct, key: line_number_format }
    label: line-number formats across the implementations read
    sub: two harnesses emit no line numbers at all
  - derive: { as: ratio, key: staleness_check, counts: "false" }
    label: will let you overwrite an edit made after the read
    sub: an invariant, not a preference
  - derive: { as: ratio, key: offset_base, counts: 0-indexed }
    label: counts lines from zero
    sub: Qwen Code; everyone else starts at one
---

Nine harnesses were read from source. The thing worth knowing first is that
almost none of the differences are the ones people argue about. Line caps and
output formatting are visible, discussed, and mostly harmless. The differences
that will actually cost you something are invisible until they bite.

## The one that loses data

Six of the nine will let an agent overwrite a file that changed after it was
read. The agent reads a file, thinks for a while, writes it back, and whatever
happened in between is gone — silently, with no error and nothing in the
transcript to suggest anything went wrong.

Three implementations guard against it, in three different places: Claude Code
requires a prior read before an edit, Hermes compares mtime at write time, and
MiMo Code tracks read state per file. That is three separate people arriving at
the same problem independently, which is usually a sign the problem is real.

This is listed as an **invariant** rather than a design choice, which means the
comparison table below shows it as pass/fail. That is a judgement, and it is the
one place on this page where we are willing to make one: there is no coherent
argument for silently discarding a concurrent edit.

## The one that is nobody's fault

Qwen Code's `read_file` is 0-indexed. Every other implementation that answers
the question starts at one. Neither is wrong — but a builder moving code between
harnesses has no way to notice until every read is off by exactly one line, and
nothing in either tool's description mentions it.

This is a **design choice**, so the table records it and does not score it.
Marking it as a failure would be the easy, wrong thing to do, and it is worth
being explicit that we are not doing it.

## Four ways to number a line

`N + TAB`, `N: `, `N|`, or nothing at all. Interesting, but it changes nobody's
decision, which is why it sits in the long tail rather than at the top.

There is one consequence worth noting. Two harnesses have written code
specifically to stop the model writing the line-number prefix back into the
source file — Claude Code instructs the model to strip it, Hermes runs a
detector on the write path that rejects content matching `N|`. Same pothole,
two patches, and neither team has any data on how often a model actually falls
in. That is precisely the kind of question this site exists to answer, and it
has not been answered yet.

## Codex does not have a read tool

It reads files by running `cat` and `sed` through `exec_command`. That is a
legitimate design — the shell is already there, and it composes — but it means
raw bytes from a binary file land in the context window with nothing to mark
them as binary, no truncation notice, and no line numbers to refer back to.
It is the only implementation surveyed where reading a file can quietly spend
the context window on bytes the model cannot use.

## What is not here

Four harnesses register a read tool that could not be verified from source:
OpenHands, OpenClaw, Grok Build and ZCode. They are named below the candidate
table rather than shown as empty rows, because a blank cell reads as "does not
do this" when the truth is "we have not checked".
