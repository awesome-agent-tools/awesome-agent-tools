---
# No `pick`, for the same reason the read page has none: nobody chooses their
# harness's grep, it arrives with the harness. Without a pick the verdict block
# does not render and this page is a reference for the people building these
# tools, not a buying guide.
updated: 2026-09-05
kpi:
  - derive: { as: ratio, key: grep_line_agrees_with_read, counts: "false" }
    label: content searches whose line numbers disagree with their own read tool
    sub: an invariant, not a preference
  - derive: { as: distinct, key: result_ordering }
    label: orderings decide which results you see
    sub: and all but one of these tools caps its results
  - derive: { as: ratio, key: search_announces_truncation, counts: "true" }
    label: say so when the cap bites
    sub: the one thing every implementation gets right
---

Twenty search tools across eleven harnesses were read from source. Code search is
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
to be handed to is not a preference. The other six harnesses where the question
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
one line of is now, as far as the harness is concerned, a file it has read. It
is the only harness here where the interaction was found; in nine other cases it
was not verified either way, so this is a lead rather than a comparison. Codex
is the one confirmed negative, and only because it has no read tracking to
subvert.

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

Codex takes this to its conclusion by not shipping a search tool at all. It
searches the way it reads: the model types `rg` or `grep` or `find` into
`exec_command`, and every row on this page becomes a property of the machine
rather than of the harness. That is a coherent position — the shell is already
there and it composes — but it is the only implementation here where a search
that found nothing and a search that failed are the same empty string, and the
only one with no result cap, so a careless pattern spends the context window
before anyone can intervene.

## Everyone caps, and everyone says so

Eighteen of the twenty tools limit what they return, and all eighteen announce
the limit. That is worth stating plainly because it is the invariant the read
page found broken: on `read`, six of nine will let an agent overwrite a
concurrent edit. Here the equivalent question comes back clean. The two
exceptions are not failures — Codex has no cap to announce, and Grok Build's
`list_dir` was not checked.

What the announcements offer differs, and the differences are larger than the
fact of announcing. Most name the cap and suggest narrowing the pattern. Kimi
Code and Hermes return an offset to page with; pi names the exact argument value
that would fetch the rest. MiMo Code reports how many matches are hidden rather
than only that some are. dsh does something no one else does: it writes the
complete result to a file and hands back the locator, so the part that did not
fit is recoverable rather than merely acknowledged — and over the cap its glob
can return a sample spread across top-level directories instead of the first
hundred paths, on the grounds that the first hundred paths of a large tree are
all in the same corner of it.

Grok Build is the one that worries about announcing too much: it reads one line
past its budget specifically so a result that exactly fills the cap is not
reported as truncated, and where it does truncate it reports "at least" counts,
because ripgrep was killed early and the true total is not known.

## .gitignore is a ceiling, and dsh refuses it

Thirteen of the eighteen tools that answered respect `.gitignore` — eight
outright, and five with a qualification: an opt-out argument the model can set,
an extra ignore file of the harness's own, or a documented way to override it.
Two more respect it only when ripgrep is the backend that happened to be picked,
as above, and one leaves it to whatever binary the model invokes. dsh goes the
other way on purpose: `--no-ignore --hidden` are fixed in its argv, VCS metadata
is the only exclusion, and the tool description says so to the model in as many
words.

Neither is wrong, which is why this is recorded as a design choice. But it is
the one setting on this page that decides whether a file is findable at all, and
a file the agent cannot find is indistinguishable, from inside the model, from a
file that does not exist.

## Two tools, or one

Eighteen of the twenty are half of a pair: a glob tool and a grep tool, and the
model has to know which job it is doing before it has looked at anything. Hermes
ships one `search_files` with a `target` argument instead, which lets the model
defer that choice by one turn. Codex ships neither.

Whether that matters is not something this page can answer — it is a question
about tool-selection behaviour, which needs a model in the loop and a run, not a
reading of the source. It is on the list.

## The same code, one line apart

MiMo Code's search tools are a fork of opencode's, close enough that whole
functions are identical. They disagree on one line: MiMo sorts matches by
modification time before applying the cap, opencode returns ripgrep's traversal
order untouched.

Neither ordering is better. But both cap at a hundred, so the line decides which
matches the model never sees — and on a repository where the hundred-and-first
match is the one that matters, the two harnesses give different answers to the
same question while running what is recognisably the same code. Eight distinct
orderings appear across this page, which makes ordering the least discussed and
most consequential row on it.

## What is not here

Five tools across three harnesses register a code-search tool that has not been
read from source, including both of Claude Code's, which publishes no tool
source to read. They are named under the candidate table rather than shown as
empty rows.

Two rows are thin even for the harnesses that were read. **Case sensitivity** was
confirmed for six of twenty: three let the model choose and default to
case-sensitive, two hardcode case-insensitive with no way to ask for anything
else, and one inherits whatever the shell was given. The **binary guard** was
confirmed for three. Those cells say `?`, which means nobody checked, not that
the behaviour is missing.

Two corrections came out of this pass. OpenClaw's `find` and `grep` were missing
from the inventory entirely, which had it recorded as searching through its
shell; it does not. And MiMo Code's `codesearch` was filed here on the strength
of its name — it calls Exa over HTTP and returns library documentation from the
public internet, never touching the repository, so it has moved to web search.
