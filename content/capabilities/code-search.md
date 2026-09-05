---
# No `pick`, for the same reason the read page has none: nobody chooses their
# harness's grep, it arrives with the harness. Without a pick the verdict block
# does not render and this page is a reference for the people building these
# tools, not a buying guide.
updated: 2026-09-04
kpi:
  - derive: { as: ratio, key: grep_line_agrees_with_read, counts: "false" }
    label: content searches whose line numbers disagree with their own read tool
    sub: an invariant, not a preference
  - derive: { as: distinct, key: result_ordering }
    label: orderings decide which results you see
    sub: and every tool here caps its results
  - derive: { as: ratio, key: search_announces_truncation, counts: "true" }
    label: say so when the cap bites
    sub: the one thing every implementation gets right
---

Eleven search tools across six harnesses were read from source. Code search is
two jobs — finding a file by its name, and finding a string inside one — and
almost every harness ships a separate tool for each, so the comparison below is
two tables rather than one.

The engine question turns out to be nearly settled: ripgrep, everywhere, in one
packaging or another. What is not settled is everything around it — where the
line numbers start, what happens when the results run out, and whether the file
you are looking for was in scope at all.

## The one that is off by one

Qwen Code's search reports 1-indexed line numbers. Its `read_file` takes a
0-indexed offset — the schema says so in as many words: *"the 0-based line
number to start reading from"*. A match reported at `L42` is at offset 41.

This is the one row on this page where two tools inside the same harness
contradict each other, and it is listed as an **invariant** rather than a design
choice. Either base is defensible on its own; the read page makes exactly that
argument about `offset_base` and declines to score it. But a search result is a
pointer into a file, and a pointer that does not resolve in the tool it is meant
to be handed to is not a preference. The other four harnesses where the question
applies use 1-indexed on both sides.

Nothing surfaces this. Both descriptions are accurate in isolation; neither
mentions the other; and the failure mode is an agent that reads the line after
the one it was looking for and concludes the code is not there.

## A search that counts as having read the file

Qwen Code's grep does one more thing on the way out. Every path it matched is
passed to `recordGrepResultFileReads`, which stats the file and records it in
the read cache as a partial read.

That is a defensible cache optimisation and it is also a hole in the read
tracking the read page spends most of its length on: a file the model has seen
one line of is now, as far as the harness is concerned, a file it has read. Of
the six harnesses here this is the only one where the interaction was found, and
in five of the six it was not verified either way — so this is a lead, not yet a
comparison.

## Half the answers depend on what is installed on the machine

OpenHands picks its search backend once, at start-up, from whatever is present:
ripgrep if it can find it, the system `grep` binary if not, and a Python
`os.walk` loop if neither. All three are reachable in normal use and nothing in
the tool result says which one ran.

Two of this page's rows change underneath that choice. The **regex dialect**
becomes Rust's regex crate, POSIX, or Python's `re` — so a pattern using
lookahead works on one machine and silently returns nothing on the next.
And **`.gitignore` stops being respected**: ripgrep honours it by default,
`grep -R` and a Python directory walk do not. The same agent, the same
repository, the same prompt, and a different set of files in scope.

Qwen Code has the same shape of fallback chain — ripgrep, then `git grep`, then
`grep`, then an in-process JavaScript scan — with the same consequence for the
dialect.

## Everyone caps, and everyone says so

Every one of the eleven tools limits what it returns, and every one of them
announces the limit. That is worth stating plainly because it is the invariant
the read page found broken: on `read`, six of nine will let an agent overwrite a
concurrent edit. Here the equivalent question comes back clean.

What the announcements offer differs. Most name the cap and suggest narrowing
the pattern. Kimi Code and Hermes return an offset to page with. dsh does
something no one else does: it writes the complete result to a file and hands
back the locator, so the part that did not fit is recoverable rather than merely
acknowledged — and over the cap its glob can return a sample spread across
top-level directories instead of the first hundred paths, on the grounds that
the first hundred paths of a large tree are all in the same corner of it.

## .gitignore is a ceiling, and dsh refuses it

Six of the ten tools that answered respect `.gitignore` outright — two with an
opt-out argument the model can set, two extending it with an AI-specific ignore
file of their own. Two more respect it only when ripgrep is the backend that
happened to be picked, as above. dsh goes the other way on purpose:
`--no-ignore --hidden` are fixed in its argv, VCS metadata is the only
exclusion, and the tool description says so to the model in as many words.

Neither is wrong, which is why this is recorded as a design choice. But it is
the one setting on this page that decides whether a file is findable at all, and
a file the agent cannot find is indistinguishable, from inside the model, from a
file that does not exist.

## Two tools, or one

Ten of the eleven are half of a pair: a glob tool and a grep tool, and the model
has to know which job it is doing before it has looked at anything. Hermes ships
one `search_files` with a `target` argument instead, which lets the model defer
that choice by one turn.

Whether that matters is not something this page can answer — it is a question
about tool-selection behaviour, which needs a model in the loop and a run, not a
reading of the source. It is on the list.

## What is not here

Thirteen tools across seven harnesses register a code-search tool that has not
been read from source, including both of Claude Code's; they are named under the
candidate table rather than shown as empty rows.

Two rows are thin even for the harnesses that were read. **Case sensitivity** was
confirmed for two of eleven — and both of those hardcode case-insensitive with no
way for the model to ask for anything else, which is interesting enough that the
other nine are worth going back for. The **binary guard** was confirmed for two.
Those cells say `?`, which means nobody checked, not that the behaviour is
missing.
