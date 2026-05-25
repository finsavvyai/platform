/** pull-aider.ts — exercism-python instructions via GitHub Contents API. Apache-2.0 / MIT. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'corpora', 'a', 'aider.jsonl');
const TARGET = 1000;
const REPO = 'exercism/python';
const BRANCH = 'main';
const CONTENTS = `https://api.github.com/repos/${REPO}/contents/exercises/practice?ref=${BRANCH}`;
const RAW = (path: string) => `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;

const headers: Record<string, string> = { 'User-Agent': 'clawpipe-booster-benchmark' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

interface Dir { name: string; path: string; type: string }

async function listExercises(): Promise<Dir[]> {
  const res = await fetch(CONTENTS, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text().catch(() => '')}`);
  return (await res.json() as Dir[]).filter((d) => d.type === 'dir');
}

async function readInstructions(slug: string): Promise<string | null> {
  const url = RAW(`exercises/practice/${slug}/.docs/instructions.md`);
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return await res.text();
}

async function readStub(slug: string): Promise<string | null> {
  const py = slug.replace(/-/g, '_');
  const url = RAW(`exercises/practice/${slug}/${py}.py`);
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return await res.text();
}

async function main() {
  mkdirSync(join(import.meta.dirname, '..', 'corpora', 'a'), { recursive: true });
  const exercises = await listExercises();
  console.log(`pull-aider: ${exercises.length} exercises listed`);
  const out: string[] = [];
  for (const ex of exercises) {
    if (out.length >= TARGET) break;
    const [instr, stub] = await Promise.all([readInstructions(ex.name), readStub(ex.name)]);
    if (!instr) continue;
    const prompt = `# ${ex.name}\n\n${instr}\n\n${stub ? `Starter:\n\`\`\`python\n${stub}\n\`\`\`\n\n` : ''}Implement the function. Return only the Python code.`;
    out.push(JSON.stringify({ id: `aider-exercism-${ex.name}`, source: REPO, slug: ex.name, prompt, expected_kind: 'python_code' }));
    if (out.length % 50 === 0) console.log(`  ...${out.length} pulled`);
  }
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`pull-aider: wrote ${out.length} rows to ${OUT}`);
}

main().catch((e) => { console.error('pull-aider failed:', e.message); process.exit(1); });
