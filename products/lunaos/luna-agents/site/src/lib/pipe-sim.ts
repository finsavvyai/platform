// Tiny pipe simulator for the playground. Parses a Luna Pipes expression and
// emits a streamable list of "trace events" the UI can render line by line.
// v1 is fully deterministic: canned outputs per verb, no LLM calls.

export type Stage = {
  verb: string;        // e.g. "persona generate"
  args: string[];      // quoted args, e.g. ["launch post"]
  repeat: number;      // *N (default 1)
  parallel: Stage[];   // || branches
};

export type Trace =
  | { kind: "parsed"; stageCount: number }
  | { kind: "stage-start"; index: number; stage: Stage }
  | { kind: "stage-line"; index: number; text: string }
  | { kind: "stage-end"; index: number; ms: number }
  | { kind: "done"; totalMs: number };

const VERBS: Record<string, (args: string[]) => string[]> = {
  "persona generate":   () => ["drafted 3 personas: SRE-lead, indie-hacker, security-architect"],
  "security scan":      () => ["scanned 312 files", "found: 14 critical, 23 high, 41 medium"],
  "fix":                (a) => [`applied ${a[0] === "all" ? 14 : 3} patches across 9 files`],
  "code-review":        () => ["reviewed PR #481", "3 findings: 1 null-safety, 2 style"],
  "ghost":              (a) => [`wrote 612-word post: "${a[0] ?? "untitled"}"`],
  "publish notion":     () => ["pushed to notion.so/luna/launches/2026-05-23", "indexed by Notion AI"],
  "deploy":             (a) => [`deployed ${a[0] ?? "staging"} in 8.2s`, "p95 latency: 142ms"],
  "lint":               () => ["12 warnings, 0 errors"],
  "summarize":          () => ["tl;dr: 3 key insights, 187 words"],
  "create pr":          () => ["opened PR #482 on lunaos-ai/luna-agents", "requested review from @shacharsol"],
  "github issues":      () => ["fetched 48 open issues across 3 repos"],
  "research competitor":() => ["mapped 4 competitors: n8n, Make, Zapier, Retool", "extracted 27 distinct features"],
};

const FALLBACK = (verb: string): string[] => [
  `[simulated] ${verb}: would call agent in real mode.`,
  `Install luna-agents to run for real.`,
];

function tokenizeArgs(rest: string): string[] {
  // Parses: word "quoted with spaces" word*4 etc. — args only, no operators.
  const args: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) args.push(m[1] ?? m[2]);
  return args;
}

function parseStage(text: string): Stage {
  // Strip "/" prefix that users may type ("/persona generate" → "persona generate")
  let t = text.trim().replace(/^\/+/, "");
  let repeat = 1;
  const repMatch = t.match(/\s\*\s*(\d+)\s*$/);
  if (repMatch) {
    repeat = Number(repMatch[1]);
    t = t.slice(0, repMatch.index).trim();
  }
  const parallel: Stage[] = [];
  if (t.includes("||")) {
    const parts = t.split(/\s*\|\|\s*/);
    t = parts[0];
    for (let i = 1; i < parts.length; i++) parallel.push(parseStage(parts[i]));
  }
  const words = t.split(/\s+/);
  // Detect 2-word verbs from VERBS table; else use first word as verb.
  let verb = words[0] ?? "";
  let argsStart = 1;
  const twoWord = `${words[0] ?? ""} ${words[1] ?? ""}`;
  if (VERBS[twoWord]) { verb = twoWord; argsStart = 2; }
  const argText = words.slice(argsStart).join(" ");
  return { verb, args: tokenizeArgs(argText), repeat, parallel };
}

export function parse(expr: string): Stage[] {
  const segs = expr.split(/\s*>>\s*/).map((s) => s.trim()).filter(Boolean);
  return segs.map(parseStage);
}

export function* simulate(expr: string): Generator<Trace> {
  const stages = parse(expr);
  yield { kind: "parsed", stageCount: stages.length };
  let total = 0;
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    yield { kind: "stage-start", index: i, stage: s };
    const handler = VERBS[s.verb];
    const lines = handler ? handler(s.args) : FALLBACK(s.verb);
    for (const ln of lines) yield { kind: "stage-line", index: i, text: ln };
    if (s.repeat > 1) {
      yield { kind: "stage-line", index: i, text: `repeated ×${s.repeat}` };
    }
    for (const branch of s.parallel) {
      yield { kind: "stage-line", index: i, text: `‖ branch: ${branch.verb}` };
      const bh = VERBS[branch.verb];
      const bl = bh ? bh(branch.args) : FALLBACK(branch.verb);
      for (const ln of bl) yield { kind: "stage-line", index: i, text: `  ${ln}` };
    }
    const ms = 120 + Math.floor(Math.random() * 380);
    total += ms;
    yield { kind: "stage-end", index: i, ms };
  }
  yield { kind: "done", totalMs: total };
}

// Render a parsed pipe as an ASCII tree. Linear stages chain top to bottom;
// `*N` expands as N siblings under the stage; `||` shows parallel branches
// fanning out from the previous stage. Pure function; safe to call alongside
// or before `simulate()`.
export function renderTree(expr: string): string {
  const stages = parse(expr);
  if (stages.length === 0) return "(empty)";
  const lines: string[] = [];
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    const argText = s.args.length ? " " + s.args.map((a) => /\s/.test(a) ? `"${a}"` : a).join(" ") : "";
    lines.push(`${s.verb}${argText}`);
    const children: string[] = [];
    if (s.repeat > 1) {
      for (let r = 0; r < s.repeat; r++) children.push(`${s.verb} #${r + 1}`);
    }
    for (const b of s.parallel) {
      const bArg = b.args.length ? " " + b.args.map((a) => `"${a}"`).join(" ") : "";
      children.push(`${b.verb}${bArg}  (parallel)`);
    }
    for (let c = 0; c < children.length; c++) {
      const last = c === children.length - 1;
      lines.push(`  ${last ? "└─" : "├─"} ${children[c]}`);
    }
    if (i < stages.length - 1) lines.push("  │");
  }
  return lines.join("\n");
}
