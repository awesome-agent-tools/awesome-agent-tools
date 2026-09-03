#!/usr/bin/env tsx
/**
 * One-time import of the two research artifacts in docs/research/ into data/.
 *
 * The tables in those files were read out of each repo by hand; this script
 * only reshapes them, it does not add facts. It is kept in the repo so the
 * path from artifact to database stays auditable — if a row here disagrees
 * with docs/research/*.html, the HTML is the original.
 *
 * Re-running overwrites the generated agent and tool files. Anything hand-added
 * to those files afterwards will be lost, so once real editing starts this
 * script becomes read-only history.
 *
 *   npx tsx scripts/seed/import-research.ts
 */
import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATA = path.join(ROOT, "data");

/** Both artifacts were read at HEAD in early September 2026. No commit hashes
 *  were recorded at the time; rather than invent them the source carries the
 *  date alone, and `npm run check` warns about the gap until they are backfilled. */
const CHECKED_AT = "2026-09-02";

/* ------------------------------------------------------------------ agents */

interface AgentMeta {
  id: string;
  name: string;
  vendor: string;
  kind: "cli" | "ide" | "framework" | "assistant";
  repo?: string;
  sourceAvailable?: boolean;
  note?: string;
}

// Order matters: it is the column order of the matrix in agent-tool-matrix.html.
const AGENTS: AgentMeta[] = [
  { id: "claude-code", name: "Claude Code", vendor: "Anthropic", kind: "cli", repo: "https://github.com/anthropics/claude-code", note: "Tool surface read from its own runtime rather than from published source." },
  { id: "codex", name: "Codex", vendor: "OpenAI", kind: "cli", repo: "https://github.com/openai/codex" },
  { id: "pi", name: "pi", vendor: "badlogic", kind: "cli", repo: "https://github.com/earendil-works/pi" },
  { id: "openhands", name: "OpenHands", vendor: "OpenHands", kind: "framework", repo: "https://github.com/OpenHands/software-agent-sdk" },
  { id: "opencode", name: "opencode", vendor: "anomalyco", kind: "cli", repo: "https://github.com/anomalyco/opencode" },
  { id: "hermes", name: "Hermes", vendor: "Nous Research", kind: "framework", repo: "https://github.com/NousResearch/hermes-agent" },
  { id: "openclaw", name: "OpenClaw", vendor: "openclaw", kind: "cli", repo: "https://github.com/openclaw/openclaw", note: "Tool list taken from published docs rather than source." },
  { id: "kimi-code", name: "Kimi Code", vendor: "Moonshot AI", kind: "cli", repo: "https://github.com/MoonshotAI/kimi-code" },
  { id: "dsh", name: "dsh", vendor: "DeepSeek", kind: "cli", repo: "https://github.com/deepseek-ai/deepseek-harness", note: "Tool list from docs/tool-catalog.md." },
  { id: "qwen-code", name: "Qwen Code", vendor: "Alibaba", kind: "cli", repo: "https://github.com/QwenLM/qwen-code" },
  { id: "grok-build", name: "Grok Build", vendor: "xAI", kind: "cli", repo: "https://github.com/xai-org/grok-build" },
  { id: "zcode", name: "ZCode", vendor: "Z.ai", kind: "cli", sourceAvailable: false, note: "No public repo reachable; tool names come from secondary reporting and are not source-verified." },
  { id: "mimo-code", name: "MiMo Code", vendor: "Xiaomi", kind: "cli", repo: "https://github.com/XiaomiMiMo/MiMo-Code" },
];

const AGENT_IDS = AGENTS.map((a) => a.id);

/* ------------------------------------------------- artifact 1 · tool matrix */

/** A cell is a tool name, "" for absent, or "~note" for reached another way. */
type MatrixRow = [string, string[]];

/** Which of the six capabilities a matrix row maps onto, and in what role.
 *  Rows with no entry here stay tools without a capability — they are real
 *  tools, they just have no comparison page yet. */
const ROW_CAPABILITY: Record<string, { id: string; role: "primary" | "partial" | "batch" }> = {
  "Run shell command": { id: "shell", role: "primary" },
  "Persistent / interactive shell": { id: "shell", role: "partial" },
  "Read file": { id: "read", role: "primary" },
  "Glob / file patterns": { id: "code-search", role: "partial" },
  "Grep / content search": { id: "code-search", role: "primary" },
  "Web search": { id: "web-search", role: "primary" },
  "Browser automation": { id: "browser", role: "primary" },
  "Persistent memory": { id: "memory", role: "primary" },
};

const MATRIX: [string, MatrixRow[]][] = [
  ["Shell & execution", [
    ["Run shell command", ["Bash", "exec_command", "bash", "terminal (execute_bash)", "bash", "terminal", "exec", "bash", "bash / pwsh", "run_shell_command", "bash", "Bash", "bash"]],
    ["Persistent / interactive shell", ["BashOutput", "write_stdin / unified_exec", "", "", "", "process", "process / terminal", "", "bash-persistent, terminal_open/read/send", "", "monitor", "~background processes", "bash-interactive"]],
    ["Kill a running process", ["KillShell", "", "", "", "", "process", "process", "", "job_kill", "", "kill_task", "", "~bash"]],
    ["Sandboxed code execution", ["", "code_mode", "", "~IPython (legacy)", "code-mode", "execute_code", "code_execution", "", "run_code, cordis_run", "", "", "", "tool-script"]],
  ]],
  ["Files", [
    ["Read file", ["Read", "~shell", "read", "file_editor (view)", "read", "read_file", "read", "read", "read", "read_file", "read_file", "Read", "read"]],
    ["Write new file", ["Write", "apply_patch", "write", "file_editor (create)", "write", "write_file", "write", "write", "write", "write_file", "~search_replace", "Write", "write"]],
    ["Edit / replace in file", ["Edit", "apply_patch", "edit", "str_replace_editor", "edit", "patch", "edit", "edit", "edit, str_replace_editor", "edit", "search_replace", "Edit", "edit, multiedit"]],
    ["Structured patch format", ["", "apply_patch", "", "apply_patch", "apply_patch", "patch", "apply_patch", "", "str_replace_editor", "", "", "", "apply_patch"]],
    ["Notebook editing", ["NotebookEdit", "", "", "", "", "", "", "", "", "", "", "", "notebook-edit"]],
    ["View image / media", ["Read", "view_image", "", "", "", "vision_analyze", "view_image", "read-media", "read_image", "~read_file", "~computer", "~image analysis", "view-image"]],
  ]],
  ["Search & code intelligence", [
    ["Glob / file patterns", ["Glob", "~shell", "find", "glob", "glob", "search_files", "~exec", "glob", "glob", "glob", "list_dir", "Glob", "glob"]],
    ["Grep / content search", ["Grep", "~shell", "grep", "grep", "grep", "search_files", "~exec", "grep", "grep", "grep_search", "grep", "Grep", "grep, codesearch"]],
    ["List directory", ["~Glob", "~shell", "ls", "~glob", "list", "~search_files", "~exec", "~glob", "~glob", "list_directory", "list_dir", "~Glob", "~glob"]],
    ["LSP / diagnostics", ["", "", "", "", "lsp", "~write-time LSP", "", "", "lsp", "", "lsp", "", "lsp"]],
  ]],
  ["Web & browser", [
    ["Fetch a URL", ["WebFetch", "~mcp", "", "~web_read", "webfetch", "web_extract", "web_fetch", "fetch-url", "web_fetch", "web_fetch", "web_fetch", "~web", "webfetch"]],
    ["Web search", ["WebSearch", "~mcp", "", "", "websearch", "web_search", "web_search", "web-search", "web_search", "web_search", "web_search", "~web search", "websearch"]],
    ["Social / X search", ["", "", "", "", "", "x_search", "x_search", "", "", "", "", "", ""]],
    ["Browser automation", ["~mcp", "", "", "browser_use", "", "browser_navigate/click/type/…", "browser", "", "", "", "~computer", "", "~mcp"]],
  ]],
  ["Planning & state", [
    ["Todo list", ["TodoWrite / TaskCreate", "update_plan", "", "task_tracker", "todowrite", "todo", "~goal tools", "todo-list", "todo_write", "todo_write", "todo", "TodoRead / TodoWrite", "todo"]],
    ["Plan mode", ["ExitPlanMode", "update_plan", "", "planning_file_editor", "plan", "", "", "enter-plan-mode / exit-plan-mode", "exit_plan_mode", "", "enter_plan_mode / exit_plan_mode", "EnterPlanMode / ExitPlanMode", "plan"]],
    ["Long-lived goals", ["", "", "", "", "", "", "get_goal / create_goal / update_goal", "create-goal, update-goal, set-goal-budget", "create_goal / get_goal / update_goal", "", "update_goal", "", "~goal loops"]],
    ["Persistent memory", ["~CLAUDE.md", "", "", "", "", "memory", "~memory host", "", "", "save_memory", "memory_get, memory_search", "", "memory"]],
    ["Scripted workflow / loop", ["Workflow", "", "", "workflow", "", "", "", "", "workflow, ralph", "", "workflow", "", "workflow"]],
  ]],
  ["Multi-agent", [
    ["Spawn subagent", ["Task", "spawn_agent", "", "delegate / task", "task", "delegate_task", "subagents", "agent, agent-swarm", "subagent", "task", "task", "Agent", "task, fleet, actor"]],
    ["Message a running agent", ["SendMessage", "send_input", "", "", "", "", "agents_list / agents_wait", "", "send_message, interrupt_agent", "", "send_subagent_message", "", "session"]],
    ["Read subagent output", ["TaskOutput", "", "", "", "", "", "session_status", "", "report, job_output", "", "task_output", "", ""]],
    ["Shared task board", ["TaskCreate / TaskUpdate", "", "", "", "", "kanban_*", "", "", "team_task_create/get/list/update, spawn_teammate", "", "", "", ""]],
    ["Isolated git worktree", ["EnterWorktree", "", "", "", "", "subagent_worktree", "", "", "", "", "~auto worktree", "", "auto-worktree"]],
  ]],
  ["Human in the loop", [
    ["Ask the user a question", ["AskUserQuestion", "request_user_input", "", "", "question", "clarify", "ask_user", "ask-user", "ask_user_question", "", "ask_user_question", "AskUserQuestion", "question"]],
    ["Request permission / approval", ["~permission modes", "request_permissions", "", "", "~permissions", "approval", "~tool policy", "", "~guard", "", "", "", "~permissions"]],
    ["Fetch a secret without seeing it", ["", "", "", "", "", "", "secrets", "", "credentials", "", "", "", ""]],
    ["Notify / message the user", ["PushNotification", "send_user_message_async", "", "", "", "send_message, react_to_message", "message", "", "", "", "", "", ""]],
  ]],
];

/* ------------------------------------------------- artifact 2 · read tools */

/** Column order of read-tools.html — a different, shorter set than the matrix. */
const READ_AGENTS = [
  "claude-code", "codex", "pi", "opencode", "hermes",
  "kimi-code", "dsh", "qwen-code", "mimo-code",
];

/** "" absent · "?" unverified · "!x" notable divergence · "x" plain value */
const READ_ROWS: [string, string, string[]][] = [
  ["dedicated_tool", "Dedicated read tool", ["Read", "!none — cat/sed via exec_command", "read", "read", "read_file", "read", "read", "read_file", "read"]],
  ["line_number_format", "Line numbering", ["N + TAB (cat -n)", "!none (raw bytes)", "!none", "N: ", "N|", "N + TAB", "numbered", "?", "N: "]],
  ["output_wrapper", "Output wrapper", ["plain", "raw stdout", "plain", "<path>/<type>/<content>", "plain", "plain", "plain", "plain", "<path>/<type>/<content>"]],
  ["default_line_cap", "Default line cap", ["2000", "!none", "2000", "2000", "2000", "!1000", "2000", "?", "2000"]],
  ["byte_cap", "Byte / char cap", ["—", "none", "50 KB", "50 KB", "!100k chars (not lines)", "100 KB", "?", "?", "50 KB"]],
  ["per_line_cap", "Per-line cap", ["2000 chars", "none", "—", "2000 chars", "—", "2000 chars", "?", "?", "2000 chars"]],
  ["limit_precedence", "Whichever-hits-first", ["lines", "—", "lines or bytes", "lines or bytes", "chars", "lines or bytes", "?", "?", "lines or bytes"]],
  ["offset_base", "Offset base", ["1-indexed", "n/a", "1-indexed", "1-indexed", "1-indexed", "1-indexed", "1-indexed", "!0-indexed", "1-indexed"]],
  ["negative_offset_tail", "Negative offset = tail", ["", "", "", "", "", "!yes (−1..−1000)", "", "", ""]],
  ["continuation_hint", "Continuation hint", ["on truncation", "—", "[Showing X-Y of N. Use offset=Z]", "(Showing X-Y of N. Use offset=Z)", "next_offset", "wasTruncated + truncatedLineNumbers", "?", "(truncated)", "(Showing X-Y of N. Use offset=Z)"]],
  ["reports_total_lines", "Reports total lines", ["?", "—", "yes", "yes (End of file - total N)", "?", "?", "?", "linesShown[]", "yes"]],
  ["out_of_range_offset", "Out-of-range offset", ["?", "n/a", "?", "explicit error w/ line count", "?", "?", "?", "?", "explicit error w/ line count"]],
  ["binary_handling", "Binary files", ["refuse", "!raw bytes into context", "?", "error: Cannot read binary file", "?", "?", "UTF-8 only", "?", "error: Cannot read binary file"]],
  ["image_handling", "Images", ["inline", "separate view_image", "attachment, auto-resize 2000²", "attachment (jpeg/png/gif/webp)", "separate vision_analyze", "separate read-media", "separate read_image (auto-downscale)", "vision bridge", "attachment + mime sniff"]],
  ["pdf_handling", "PDFs", ["pages param, max 20/req", "", "?", "attachment", "?", "read-media", "?", "page ranges + continuation", "attachment"]],
  ["notebook_handling", "Notebooks", ["cells + outputs", "", "?", "?", "?", "?", "?", "?", "(notebook-edit tool)"]],
  ["giant_line_handling", "Giant single line", ["per-line cap", "none", "!points at bash sed fallback", "per-line cap", "char budget absorbs it", "per-line cap", "?", "?", "per-line cap"]],
  ["missing_path_behavior", "Missing path", ["error", "shell error", "?", "!Did you mean one of these?", "?", "?", "?", "?", "!Did you mean one of these?"]],
  ["directory_path_behavior", "Path is a directory", ["error", "lists", "?", "lists entries", "?", "?", "?", "?", "lists entries"]],
  ["empty_file_behavior", "Empty file", ["explicit reminder", "empty stdout", "?", "?", "?", "?", "?", "?", "?"]],
  ["non_vision_model_behavior", "Non-vision model", ["—", "—", "!explicit note in output", "?", "?", "?", "requires image-capable model", "?", "?"]],
  ["mixed_line_endings", "Mixed line endings", ["?", "raw", "?", "?", "?", "!renders CR visibly", "?", "?", "?"]],
  ["reread_dedup", "Re-read dedup", ["", "", "", "", "!(path,offset,limit)→mtime, 'File unchanged since last read'", "", "", "file read cache", ""]],
  ["line_number_guard", "Line-number contamination guard", ["!instructs model to strip prefix", "n/a (no numbers)", "n/a (no numbers)", "", "!write-side detector rejects N| content", "", "", "", ""]],
  ["multi_file_read", "Multi-file read", ["", "", "", "", "", "", "concurrent batches", "!read_many_files", ""]],
  ["warms_lsp", "Warms LSP on read", ["", "", "", "yes", "", "", "", "", "yes"]],
  ["injects_instruction_files", "Injects nearby instruction files", ["", "", "compact AGENTS.md/CLAUDE.md", "AGENTS.md as system-reminder", "", "", "", "", "AGENTS.md as system-reminder"]],
];

/** Rows in the artifact are prose. These two invariants are boolean readings of
 *  that prose, stated explicitly here so the interpretation is reviewable rather
 *  than buried in a template. */
const STALENESS: Record<string, { value: boolean; note?: string }> = {
  "claude-code": { value: true, note: "Edit requires a prior read of the same file." },
  codex: { value: false },
  pi: { value: false },
  opencode: { value: false },
  hermes: { value: true, note: "Compares mtime on write." },
  "kimi-code": { value: false },
  dsh: { value: false },
  "qwen-code": { value: false },
  "mimo-code": { value: true, note: "Tracks read state per file." },
};

const BINARY_NOT_SILENT: Record<string, { value?: boolean; status?: "unverified"; note?: string }> = {
  "claude-code": { value: true, note: "Refuses binary files." },
  codex: { value: false, note: "Reading through the shell puts raw bytes straight into context with nothing to mark them as binary." },
  pi: { status: "unverified" },
  opencode: { value: true, note: "Explicit error: Cannot read binary file." },
  hermes: { status: "unverified" },
  "kimi-code": { status: "unverified" },
  dsh: { value: true, note: "Accepts UTF-8 only." },
  "qwen-code": { status: "unverified" },
  "mimo-code": { value: true, note: "Explicit error: Cannot read binary file." },
};

const ANNOUNCES_TRUNCATION: Record<string, { value?: boolean; status?: "unverified" | "not-applicable"; note?: string }> = {
  "claude-code": { value: true, note: "Emitted on truncation." },
  codex: { status: "not-applicable", note: "No read tool; the shell returns whatever the command produced." },
  pi: { value: true, note: "[Showing X-Y of N. Use offset=Z]" },
  opencode: { value: true, note: "(Showing X-Y of N. Use offset=Z)" },
  hermes: { value: true, note: "Returns next_offset." },
  "kimi-code": { value: true, note: "wasTruncated plus truncatedLineNumbers." },
  dsh: { status: "unverified" },
  "qwen-code": { value: true, note: "(truncated)" },
  "mimo-code": { value: true, note: "(Showing X-Y of N. Use offset=Z)" },
};

/** Four harnesses register a read tool that the research could not verify from
 *  source. They belong on the comparison page as present-but-unverified rather
 *  than as blank rows — an empty cell reads like "nothing there", which is a
 *  different claim from "we could not check". */
const READ_NOT_VERIFIED: Record<string, string> = {
  openhands: "Reads through the view mode of file_editor; behaviour not verified from source.",
  openclaw: "Registers a read tool; behaviour not verified from source.",
  "grok-build": "Registers read_file; behaviour not verified from source. Global tool caps are documented as 40 KB / 20k chars.",
  zcode: "Registers Read, but no public repo was reachable, so nothing here is source-verified.",
};

/**
 * Cells that confirm something happens without pinning down what. dsh's line
 * numbering is recorded as "numbered", which is not a format — treating it as
 * one would invent a fifth format that nobody has seen. These become
 * `unverified` with the original wording kept as a note.
 */
const VAGUE: Record<string, string[]> = {
  line_number_format: ["numbered"],
};

/** The artifact writes enum cells with the evidence folded in ("N + TAB
 *  (cat -n)"). The registry declares the bare format, so the qualifier moves to
 *  a note — the value stays comparable across rows, the detail stays visible. */
const ENUM_NORMALISE: Record<string, Record<string, { value: string; note: string }>> = {
  line_number_format: {
    "N + TAB (cat -n)": { value: "N + TAB", note: "Matches the output of cat -n." },
    "none (raw bytes)": { value: "none", note: "Raw bytes, no numbering at all." },
  },
};

/* ------------------------------------------------------------------ helpers */

interface Obs {
  key: string;
  value?: string | boolean;
  status?: string;
  note?: string;
  method?: string;
}

interface ToolAcc {
  ownerId: string;
  fileName: string;
  exposed_name: string;
  capabilities: { id: string; role: string }[];
  via?: string;
  notes?: string;
  observations: Obs[];
}

/** Tool file names mirror the URL, so they must be filesystem- and URL-safe
 *  while the exposed_name they carry stays byte-for-byte what the model sees. */
function fileNameFor(exposedName: string): string {
  return exposedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** One matrix cell can name several tools ("edit, multiedit"). A cell using
 *  "/" with an ellipsis names a family, which we record as its first member
 *  plus a note rather than inventing entries for members we did not verify. */
function splitCell(cell: string): { names: string[]; familyNote?: string } {
  if (cell.includes("…")) {
    const stem = cell.replace(/…/g, "").replace(/\/\s*$/, "");
    const parts = stem.split("/").map((s) => s.trim()).filter(Boolean);
    return {
      names: parts.slice(0, 1),
      familyNote: `The harness registers a family of related tools (${cell}); the research recorded the family rather than each member.`,
    };
  }
  if (cell.includes(" / ")) return { names: cell.split(" / ").map((s) => s.trim()).filter(Boolean) };
  if (cell.includes(", ")) return { names: cell.split(", ").map((s) => s.trim()).filter(Boolean) };
  return { names: [cell.trim()] };
}

/** "terminal (execute_bash)" -> name "terminal", note about the inner name. */
function stripParenthetical(name: string): { name: string; note?: string } {
  const m = name.match(/^(.+?)\s*\((.+)\)$/);
  if (!m) return { name };
  return { name: m[1].trim(), note: `Recorded in the source as "${name}".` };
}

function main() {
  const tools = new Map<string, ToolAcc>();

  const keyOf = (ownerId: string, fileName: string) => `${ownerId}/${fileName}`;

  function upsert(ownerId: string, exposedName: string, extra: Partial<ToolAcc> = {}): ToolAcc {
    const fileName = fileNameFor(exposedName);
    const k = keyOf(ownerId, fileName);
    let acc = tools.get(k);
    if (!acc) {
      acc = { ownerId, fileName, exposed_name: exposedName, capabilities: [], observations: [] };
      tools.set(k, acc);
    }
    if (extra.via && !acc.via) acc.via = extra.via;
    if (extra.notes && !acc.notes) acc.notes = extra.notes;
    return acc;
  }

  function addCapability(acc: ToolAcc, id: string, role: string) {
    const existing = acc.capabilities.find((c) => c.id === id);
    if (!existing) {
      acc.capabilities.push({ id, role });
      return;
    }
    // A tool that is primary for a capability anywhere stays primary.
    if (existing.role !== "primary" && role === "primary") existing.role = "primary";
  }

  /* -- pass 1 · the tool matrix gives us the inventory -------------------- */
  for (const [, rows] of MATRIX) {
    for (const [label, cells] of rows) {
      const cap = ROW_CAPABILITY[label];
      cells.forEach((cell, i) => {
        const ownerId = AGENT_IDS[i];
        if (!cell) return;

        if (cell.startsWith("~")) {
          // Reached another way. Only meaningful to record when the row maps to
          // a capability — otherwise it is a note about nothing in particular.
          if (!cap) return;
          const via = cell.slice(1).trim();
          // Where the workaround is another tool in the same harness, attach the
          // capability to that tool instead of inventing a record.
          const target = [...tools.values()].find(
            (t) => t.ownerId === ownerId && t.exposed_name.toLowerCase() === via.toLowerCase(),
          );
          if (target) {
            addCapability(target, cap.id, "partial");
            if (!target.via) target.via = `Serves "${label}" indirectly.`;
            return;
          }
          if (via === "shell" || via === "exec") {
            const shellTool = [...tools.values()].find(
              (t) => t.ownerId === ownerId && t.capabilities.some((c) => c.id === "shell" && c.role === "primary"),
            );
            if (shellTool) {
              addCapability(shellTool, cap.id, "partial");
              shellTool.via = `Reached through the shell rather than a dedicated tool.`;
              return;
            }
          }
          return; // e.g. "~mcp": no built-in tool exists, so the matrix cell is empty here
        }

        const { names, familyNote } = splitCell(cell);
        for (const raw of names) {
          const { name, note } = stripParenthetical(raw);
          if (!name) continue;
          const acc = upsert(ownerId, name, { notes: familyNote ?? note });
          if (cap) addCapability(acc, cap.id, cap.role);
        }
      });
    }
  }

  /* -- pass 2 · the read comparison adds observations --------------------- */
  const readObs = new Map<string, Obs[]>();
  const push = (ownerId: string, obs: Obs) => {
    if (!readObs.has(ownerId)) readObs.set(ownerId, []);
    readObs.get(ownerId)!.push(obs);
  };

  for (const [key, , cells] of READ_ROWS) {
    cells.forEach((cell, i) => {
      const ownerId = READ_AGENTS[i];
      const raw = cell.startsWith("!") ? cell.slice(1) : cell;
      if (raw === "") return; // absent from the implementation
      if (raw === "?") {
        push(ownerId, { key, status: "unverified" });
        return;
      }
      if (raw === "—" || raw.startsWith("n/a")) {
        push(ownerId, { key, status: "not-applicable", note: raw.startsWith("n/a") ? raw : undefined });
        return;
      }
      if (VAGUE[key]?.includes(raw)) {
        push(ownerId, {
          key,
          status: "unverified",
          note: `Source confirms lines are ${raw}, but the exact format was not established.`,
        });
        return;
      }
      const normalised = ENUM_NORMALISE[key]?.[raw];
      if (normalised) {
        push(ownerId, { key, value: normalised.value, note: normalised.note });
        return;
      }
      push(ownerId, { key, value: raw });
    });
  }

  for (const [ownerId, entry] of Object.entries(STALENESS)) {
    push(ownerId, { key: "staleness_check", value: entry.value, note: entry.note });
  }
  for (const [ownerId, entry] of Object.entries(BINARY_NOT_SILENT)) {
    push(ownerId, entry.status ? { key: "binary_not_silent", status: entry.status } : { key: "binary_not_silent", value: entry.value, note: entry.note });
  }
  for (const [ownerId, entry] of Object.entries(ANNOUNCES_TRUNCATION)) {
    push(ownerId, entry.status ? { key: "announces_truncation", status: entry.status, note: entry.note } : { key: "announces_truncation", value: entry.value, note: entry.note });
  }

  // Attach each harness's read observations to whichever tool actually serves
  // read for it — a dedicated tool where one exists, the shell where not.
  for (const ownerId of READ_AGENTS) {
    const obs = readObs.get(ownerId) ?? [];
    const target = [...tools.values()].find(
      (t) => t.ownerId === ownerId && t.capabilities.some((c) => c.id === "read"),
    );
    if (!target) {
      console.warn(`  ! ${ownerId}: read observations recorded but no tool carries the read capability`);
      continue;
    }
    target.observations.push(...obs);
  }

  for (const [ownerId, reason] of Object.entries(READ_NOT_VERIFIED)) {
    const target = [...tools.values()].find(
      (t) => t.ownerId === ownerId && t.capabilities.some((c) => c.id === "read"),
    );
    if (target) target.notes = target.notes ? `${target.notes} ${reason}` : reason;
    else console.warn(`  ! ${ownerId}: no read tool to attach the unverified note to`);
  }

  /* -- write ------------------------------------------------------------- */
  const agentDir = path.join(DATA, "agents");
  fs.rmSync(agentDir, { recursive: true, force: true });
  fs.mkdirSync(agentDir, { recursive: true });

  for (const a of AGENTS) {
    const doc: Record<string, unknown> = {
      name: a.name,
      vendor: a.vendor,
      kind: a.kind,
    };
    if (a.repo) doc.repo = a.repo;
    if (a.sourceAvailable === false) doc.source_available = false;
    if (a.note) doc.notes = a.note;
    doc.adoption = [];
    doc.observations = [];
    fs.writeFileSync(
      path.join(agentDir, `${a.id}.yaml`),
      header(`${a.name} — imported from docs/research/agent-tool-matrix.html`) + stringify(doc, { lineWidth: 96 }),
    );
  }

  const toolsDir = path.join(DATA, "tools");
  fs.rmSync(toolsDir, { recursive: true, force: true });

  let count = 0;
  for (const acc of [...tools.values()].sort((a, b) => keyOf(a.ownerId, a.fileName).localeCompare(keyOf(b.ownerId, b.fileName)))) {
    const agent = AGENTS.find((a) => a.id === acc.ownerId)!;
    const dir = path.join(toolsDir, acc.ownerId);
    fs.mkdirSync(dir, { recursive: true });

    const doc: Record<string, unknown> = {
      exposed_name: acc.exposed_name,
      owner: { type: "agent", id: acc.ownerId },
    };
    if (acc.capabilities.length) doc.capabilities = acc.capabilities;
    if (acc.via) doc.via = acc.via;
    doc.source = {
      url: agent.repo ?? "https://github.com/",
      checked_at: CHECKED_AT,
    };
    if (!agent.repo) {
      // Nothing to point at, so the tool carries no assertable observations
      // either; the site says "not source-verified" rather than showing a row.
      delete doc.source;
    }
    if (acc.observations.length) {
      doc.observations = acc.observations.map((o) => {
        const out: Record<string, unknown> = { key: o.key };
        if (o.value !== undefined) out.value = typeof o.value === "boolean" ? o.value : String(o.value);
        if (o.status) out.status = o.status;
        if (o.note) out.note = o.note;
        out.method = agent.id === "claude-code" ? "runtime" : "source";
        return out;
      });
    }
    if (acc.notes) doc.notes = acc.notes;

    fs.writeFileSync(
      path.join(dir, `${acc.fileName}.yaml`),
      header(`${agent.name} · ${acc.exposed_name}`) + stringify(doc, { lineWidth: 96 }),
    );
    count++;
  }

  console.log(`\n  wrote ${AGENTS.length} agents and ${count} tools\n`);
}

function header(what: string): string {
  return `# ${what}\n# Generated by scripts/seed/import-research.ts from docs/research/.\n`;
}

main();
