/** pull-humaneval.ts — HumanEval (openai_humaneval), 164 Python problems. Public, MIT. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'corpora', 'a', 'humaneval.jsonl');
const DATASET = 'openai/openai_humaneval';
const SPLIT = 'test';
const URL = 'https://datasets-server.huggingface.co/rows';

interface Row { row_idx: number; row: { task_id: string; prompt: string; canonical_solution: string; test: string; entry_point: string } }

async function fetchBatch(offset: number, length: number): Promise<Row[]> {
  const u = `${URL}?dataset=${encodeURIComponent(DATASET)}&config=openai_humaneval&split=${SPLIT}&offset=${offset}&length=${length}`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HF ${res.status} at offset ${offset}`);
  const json = await res.json() as { rows?: Row[] };
  return json.rows ?? [];
}

async function main() {
  mkdirSync(join(import.meta.dirname, '..', 'corpora', 'a'), { recursive: true });
  const out: string[] = [];
  let offset = 0;
  while (true) {
    const rows = await fetchBatch(offset, 100);
    if (rows.length === 0) break;
    for (const r of rows) {
      const prompt = `Complete this Python function:\n\n${r.row.prompt}\n\nReturn only the function body — do not repeat the signature.`;
      out.push(JSON.stringify({ id: r.row.task_id, source: DATASET, prompt, expected_kind: 'python_code', entry_point: r.row.entry_point }));
    }
    offset += 100;
  }
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`pull-humaneval: wrote ${out.length} rows to ${OUT}`);
}

main().catch((e) => { console.error('pull-humaneval failed:', e.message); process.exit(1); });
