// Builds project-aware context blocks for the NLP endpoint.
//
// This is the difference between "generic CI advice" and answers
// that actually reference the user's current pipeline state. When
// the chat sends a repoContext, the NLP endpoint calls
// buildProjectContext() to fetch recent runs from D1 and format
// them as markdown for Claude to read alongside the user's
// question.
//
// Kept separate from nlp.ts so that file stays under the 200-line
// cap and the context logic can grow (pushci.yml fetching, skill
// list, deploy target history) without bloating the HTTP handler.

import type { Env, Run } from "./types";
import { listRunsByRepoForUser } from "./db";

// buildProjectContext assembles a short markdown block the chat can
// pass to Claude so answers reference the user's ACTUAL project
// state instead of generic CI advice. The block is deliberately
// small (5 recent runs, max 5 checks each, 5 lines of output per
// failed check) to stay well under the token budget.
export async function buildProjectContext(
  env: Env,
  repo: string,
  branch: string | undefined,
  userSub: string,
): Promise<string> {
  const runs = await listRunsByRepoForUser(env.DB, repo, userSub, 5).catch(() => [] as Run[]);
  const lines: string[] = [];
  lines.push(`## Project context`);
  lines.push(`- Repo: ${repo}`);
  if (branch) lines.push(`- Branch: ${branch}`);

  if (runs.length === 0) {
    lines.push(`- No CI runs recorded yet for this project.`);
    return lines.join("\n");
  }

  lines.push(`- Recent runs (newest first):`);
  for (const run of runs) {
    const duration = run.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : "running";
    const sha = run.sha ? run.sha.slice(0, 7) : "unknown";
    lines.push(`  - ${run.status} ${sha} on ${run.branch} (${duration})`);
  }

  appendLastFailedChecks(lines, runs);
  return lines.join("\n");
}

// appendLastFailedChecks inspects the most recent failed run and
// emits its check summary + tail of output for each failing check.
// Lets Claude reference concrete failures in its answer instead of
// hallucinating. Silently skips if checks_json is unparseable — we
// already have the run summary line above.
function appendLastFailedChecks(lines: string[], runs: Run[]): void {
  const lastFailed = runs.find((r) => r.status === "failed");
  if (!lastFailed?.checks_json) return;

  let checks: unknown;
  try {
    checks = JSON.parse(lastFailed.checks_json);
  } catch {
    return;
  }
  if (!Array.isArray(checks)) return;

  lines.push(``);
  lines.push(`### Last failed run checks`);
  for (const check of checks.slice(0, 5)) {
    if (typeof check !== "object" || check === null) continue;
    const c = check as { name?: string; status?: string; output?: string };
    lines.push(`- ${c.name ?? "unnamed"}: ${c.status ?? "?"}`);
    if (c.status === "failed" && c.output) {
      const tail = c.output.split("\n").slice(-5).join("\n");
      lines.push(`  \`\`\`\n${tail}\n\`\`\``);
    }
  }
}
