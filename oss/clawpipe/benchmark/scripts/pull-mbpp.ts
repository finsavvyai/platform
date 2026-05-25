/** pull-mbpp.ts — MBPP for Bucket A coding-style coverage (public, MIT). */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'corpora', 'a', 'mbpp.jsonl');
const TARGET = 1000;
const BATCH = 100;
const DATASET = 'google-research-datasets/mbpp';
const CONFIG = 'full';
const SPLIT = 'train';
const URL = 'https://datasets-server.huggingface.co/rows';

interface Row { row_idx: number; row: { task_id: number; text: string; test_list: string[]; code?: string } }

async function fetchBatch(offset: number, length: number): Promise<Row[]> {
  const u = `${URL}?dataset=${encodeURIComponent(DATASET)}&config=${CONFIG}&split=${SPLIT}&offset=${offset}&length=${length}`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HF ${res.status} at offset ${offset}`);
  const json = await res.json() as { rows?: Row[] };
  return json.rows ?? [];
}

async function main() {
  mkdirSync(join(import.meta.dirname, '..', 'corpora', 'a'), { recursive: true });
  const out: string[] = [];
  let offset = 0;
  while (out.length < TARGET) {
    const rows = await fetchBatch(offset, BATCH);
    if (rows.length === 0) break;
    for (const r of rows) {
      if (out.length >= TARGET) break;
      const prompt = `Write a Python function that solves this:\n${r.row.text}\n\nThe function must pass these test cases:\n${r.row.test_list.join('\n')}\n\nReturn only the function definition.`;
      out.push(JSON.stringify({ id: `mbpp-${r.row.task_id}`, source: DATASET, prompt, expected_kind: 'python_code' }));
    }
    offset += BATCH;
    if (offset % 500 === 0) console.log(`  ...${out.length}/${TARGET} pulled (offset=${offset})`);
  }
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`pull-mbpp: wrote ${out.length} rows to ${OUT}`);
}

main().catch((e) => { console.error('pull-mbpp failed:', e.message); process.exit(1); });
