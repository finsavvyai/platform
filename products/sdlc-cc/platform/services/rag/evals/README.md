# RAG Evaluation (RAGAS)

Nightly quality gate for the SDLC RAG pipeline. Uses
[RAGAS](https://github.com/explodinggradients/ragas) to score a curated
golden set against the deployed RAG service.

## Layout

```
services/rag/evals/
  golden_set.yaml         Curated Q&A + expected sources (versioned)
  run_ragas.py            Queries the RAG service, runs RAGAS metrics
  ragas_to_langfuse.py    Uploads per-question + aggregate scores to Langfuse
  ragas_summary.json      (generated) last run output, CI artifact
```

## Metrics we track

| Metric              | What it measures                                             | Threshold |
| ------------------- | ------------------------------------------------------------ | --------- |
| `faithfulness`      | Answer is grounded in retrieved context (no hallucination)   | >= 0.80   |
| `answer_relevancy`  | Answer actually addresses the question                       | >= 0.75   |
| `context_precision` | Retrieved chunks are relevant to the question (monitor only) | -         |
| `context_recall`    | Retrieval surfaced all ground-truth facts (monitor only)     | -         |

### Threshold rationale

- **Faithfulness 0.80** — hallucinated answers are the highest-severity
  failure mode for a compliance-focused RAG platform. 0.80 is the point
  where RAGAS literature reports near-zero unsupported claims on curated
  sets; below that we ship risk. Release-blocking.
- **Answer relevancy 0.75** — we allow some slack because the golden set
  intentionally includes out-of-scope questions that *should* decline;
  those pull the mean down slightly even when behavior is correct.
  Release-blocking.
- **Context precision / recall** — tracked on dashboards but not gated,
  because retrieval tuning is an ongoing optimization that should not
  block shipping unrelated changes.

## Running locally

1. Start the RAG service (in another terminal):
   ```bash
   cd services/rag
   uvicorn app.main:app --reload --port 8000
   ```

2. Export an OpenAI key for the RAGAS judge model and run:
   ```bash
   export OPENAI_API_KEY=sk-...
   export RAG_BASE_URL=http://localhost:8000/api/v1
   pip install -r services/rag/requirements.txt
   python services/rag/evals/run_ragas.py
   ```

3. Inspect the output:
   ```bash
   cat services/rag/evals/ragas_summary.json | jq '.aggregate'
   ```

4. (Optional) Upload scores to Langfuse:
   ```bash
   export LANGFUSE_ENABLED=true
   export LANGFUSE_PUBLIC_KEY=...
   export LANGFUSE_SECRET_KEY=...
   python services/rag/evals/ragas_to_langfuse.py --run-name "local-$(date +%F)"
   ```

### Useful flags

- `--base-url` — override the RAG service URL (also via `RAG_BASE_URL`).
- `--skip-threshold-check` — compute scores without failing on regressions
  (useful when iterating on the golden set itself).
- `--out` — write the JSON summary somewhere other than the default.

## Adding entries to the golden set

Edit `golden_set.yaml` and add an entry under `entries:` with these
fields:

```yaml
- id: <short-unique-id>          # e.g. comp-007
  category: compliance            # factual | multi_hop | out_of_scope | compliance
  question: "Your question here"
  expected_answer: "Canonical answer used as ground_truth for RAGAS."
  expected_sources:
    - "path/or/doc/id/used/by/retrieval"
```

Rules of thumb:

- **Keep the file under 200 lines.** Split into buckets if it grows.
- **Category balance matters.** Aim for roughly a 4/4/4/6 split across
  factual, multi-hop, out-of-scope, and compliance buckets so that the
  aggregate metric is not dominated by a single query style.
- **Ground truth must be unambiguous.** RAGAS uses it directly for
  `context_recall`; vague answers make scores noisy.
- **Out-of-scope entries must expect a graceful decline.** Use the exact
  phrase `"I do not have information about that in the provided context."`
  so regressions are easy to spot.
- **Bump `version`** in the YAML header on any breaking schema change.

After editing, run `run_ragas.py` locally with `--skip-threshold-check`
to sanity-check the new entries before merging.

## CI

The GitHub Actions workflow lives at `.github/workflows/ragas-eval.yml`:

- Runs nightly at 02:00 UTC and on manual dispatch.
- Targets the staging RAG URL by default (overridable on dispatch).
- Uploads `ragas_summary.json` as an artifact for 30 days.
- Posts aggregate and per-question scores to Langfuse.
- Comments a markdown summary table on the latest commit.
- Fails the job (and thus the quality gate) if `faithfulness < 0.80` or
  `answer_relevancy < 0.75`.

Required repo secrets:

- `OPENAI_API_KEY`
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`
- `RAGAS_EVAL_TENANT_ID` (tenant used against staging)
