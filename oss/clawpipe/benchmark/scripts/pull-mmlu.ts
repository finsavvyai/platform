/** pull-mmlu.ts — MMLU subsets via HF Datasets Server API. Public, no auth. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'corpora', 'c', 'mmlu.jsonl');
const TARGET = 2500;
const BATCH = 100;
const DATASET = 'cais/mmlu';
const CONFIG = 'all';
const SPLIT = 'test';
const URL = 'https://datasets-server.huggingface.co/rows';

interface Row { row_idx: number; row: { question: string; choices: string[]; answer: number; subject: string } }

async function fetchBatch(offset: number, length: number): Promise<Row[]> {
  const u = `${URL}?dataset=${encodeURIComponent(DATASET)}&config=${CONFIG}&split=${SPLIT}&offset=${offset}&length=${length}`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HF ${res.status} at offset ${offset}`);
  const json = await res.json() as { rows?: Row[] };
  return json.rows ?? [];
}

async function main() {
  mkdirSync(join(import.meta.dirname, '..', 'corpora', 'c'), { recursive: true });
  const out: string[] = [];
  let offset = 0;
  while (out.length < TARGET) {
    const rows = await fetchBatch(offset, BATCH);
    if (rows.length === 0) break;
    for (const r of rows) {
      if (out.length >= TARGET) break;
      const prompt = `Question: ${r.row.question}\nChoices:\n${r.row.choices.map((c, i) => `${'ABCD'[i]}. ${c}`).join('\n')}\nAnswer with a single letter.`;
      const expected = 'ABCD'[r.row.answer];
      out.push(JSON.stringify({ id: `mmlu-${r.row_idx}`, source: 'cais/mmlu', subject: r.row.subject, prompt, expected }));
    }
    offset += BATCH;
    if (offset % 1000 === 0) console.log(`  ...${out.length}/${TARGET} pulled (offset=${offset})`);
  }
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`pull-mmlu: wrote ${out.length} rows to ${OUT}`);
}

main().catch((e) => { console.error('pull-mmlu failed:', e.message); process.exit(1); });
