/** pull-swebench.ts — SWE-bench_Lite via HF Datasets Server API. Public. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'corpora', 'a', 'swebench.jsonl');
const TARGET = 300; // SWE-bench_Lite is 300 cases; full requires HF rate-limit handling.
const BATCH = 100;
const DATASET = 'princeton-nlp/SWE-bench_Lite';
const SPLIT = 'test';
const URL = 'https://datasets-server.huggingface.co/rows';

interface Row {
  row_idx: number;
  row: { instance_id: string; problem_statement: string; repo: string; base_commit: string; hints_text?: string };
}

async function fetchBatch(offset: number, length: number): Promise<Row[]> {
  const u = `${URL}?dataset=${encodeURIComponent(DATASET)}&config=default&split=${SPLIT}&offset=${offset}&length=${length}`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HF ${res.status} at offset ${offset}: ${await res.text().catch(() => '')}`);
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
      const prompt = `Repository: ${r.row.repo}@${r.row.base_commit}\n\nProblem statement:\n${r.row.problem_statement}\n\n${r.row.hints_text ? `Hints:\n${r.row.hints_text}\n\n` : ''}Identify the file(s) most likely to need modification.`;
      out.push(JSON.stringify({ id: r.row.instance_id, source: DATASET, prompt, expected_kind: 'file_path_list' }));
    }
    offset += BATCH;
    if (offset % 500 === 0) console.log(`  ...${out.length}/${TARGET} pulled (offset=${offset})`);
  }
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`pull-swebench: wrote ${out.length} rows to ${OUT}`);
}

main().catch((e) => { console.error('pull-swebench failed:', e.message); process.exit(1); });
