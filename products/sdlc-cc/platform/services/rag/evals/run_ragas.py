"""
RAGAS evaluation runner for the SDLC RAG service.

Loads ``golden_set.yaml``, hits the RAG service ``/rag/query`` endpoint for
each question, collects answers + retrieved contexts, and runs the core
RAGAS metrics (faithfulness, answer_relevancy, context_precision,
context_recall).

Outputs a JSON summary to ``--out`` (default: ``ragas_summary.json``) with
per-question scores and aggregate metrics. Exits non-zero if any aggregate
metric falls below its threshold so it can gate CI.

Environment:
    RAG_BASE_URL        base URL of the running RAG service
                        (default: http://localhost:8000/api/v1)
    RAG_TENANT_ID       optional tenant id sent with each request
    RAGAS_OPENAI_MODEL  model for the RAGAS judge (default: gpt-4o-mini)
    OPENAI_API_KEY      required for ragas metrics
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import httpx
import yaml

logger = logging.getLogger("ragas_eval")

DEFAULT_BASE_URL = "http://localhost:8000/api/v1"
DEFAULT_GOLDEN = Path(__file__).parent / "golden_set.yaml"
DEFAULT_OUT = Path(__file__).parent / "ragas_summary.json"

# Thresholds that gate CI. Kept in sync with .github/workflows/ragas-eval.yml.
THRESHOLDS: Dict[str, float] = {
    "faithfulness": 0.80,
    "answer_relevancy": 0.75,
}


def load_golden_set(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return data.get("entries", [])


def query_rag(base_url: str, question: str, tenant_id: str | None) -> Dict[str, Any]:
    """Call the RAG /query endpoint and normalize the result."""
    payload: Dict[str, Any] = {"query": question, "citation_styles": ["APA"]}
    if tenant_id:
        payload["tenant_id"] = tenant_id
    url = f"{base_url.rstrip('/')}/rag/query"
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()
        body = resp.json()
    answer = body.get("answer") or ""
    contexts: List[str] = []
    for src in body.get("sources", []) or []:
        text = src.get("text") or src.get("source") or ""
        if text:
            contexts.append(text)
    if not contexts and body.get("context"):
        contexts = [body["context"]]
    return {"answer": answer, "contexts": contexts}


def build_dataset(entries: List[Dict[str, Any]], responses: List[Dict[str, Any]]):
    """Build a HF dataset in the shape RAGAS expects."""
    from datasets import Dataset

    rows = {
        "question": [],
        "answer": [],
        "contexts": [],
        "ground_truth": [],
    }
    for entry, resp in zip(entries, responses):
        rows["question"].append(entry["question"])
        rows["answer"].append(resp["answer"])
        rows["contexts"].append(resp["contexts"] or [""])
        rows["ground_truth"].append(entry["expected_answer"])
    return Dataset.from_dict(rows)


def run_ragas_metrics(dataset) -> Dict[str, List[float]]:
    """Run RAGAS metrics and return a dict of metric_name -> per-row scores."""
    from ragas import evaluate
    from ragas.metrics import (
        answer_relevancy,
        context_precision,
        context_recall,
        faithfulness,
    )

    metrics = [faithfulness, answer_relevancy, context_precision, context_recall]
    result = evaluate(dataset, metrics=metrics)
    df = result.to_pandas()
    out: Dict[str, List[float]] = {}
    for metric in ("faithfulness", "answer_relevancy", "context_precision", "context_recall"):
        if metric in df.columns:
            out[metric] = [float(v) if v == v else 0.0 for v in df[metric].tolist()]
    return out


def aggregate(scores: Dict[str, List[float]]) -> Dict[str, float]:
    return {k: (sum(v) / len(v) if v else 0.0) for k, v in scores.items()}


def build_summary(
    entries: List[Dict[str, Any]],
    responses: List[Dict[str, Any]],
    scores: Dict[str, List[float]],
) -> Dict[str, Any]:
    per_question = []
    for i, entry in enumerate(entries):
        per_question.append(
            {
                "id": entry["id"],
                "category": entry.get("category", "unknown"),
                "question": entry["question"],
                "answer": responses[i]["answer"],
                "num_contexts": len(responses[i]["contexts"]),
                "scores": {m: scores[m][i] for m in scores if i < len(scores[m])},
            }
        )
    aggregates = aggregate(scores)
    return {
        "dataset": "sdlc-rag-golden-v1",
        "num_questions": len(entries),
        "aggregate": aggregates,
        "thresholds": THRESHOLDS,
        "per_question": per_question,
    }


def check_thresholds(aggregates: Dict[str, float]) -> List[str]:
    failures = []
    for metric, threshold in THRESHOLDS.items():
        value = aggregates.get(metric, 0.0)
        if value < threshold:
            failures.append(f"{metric}={value:.3f} < {threshold:.2f}")
    return failures


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Run RAGAS evaluation against the RAG service.")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--base-url", default=os.getenv("RAG_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--skip-threshold-check", action="store_true")
    args = parser.parse_args()

    entries = load_golden_set(args.golden)
    logger.info("Loaded %d golden entries from %s", len(entries), args.golden)

    tenant_id = os.getenv("RAG_TENANT_ID")
    responses: List[Dict[str, Any]] = []
    for entry in entries:
        try:
            responses.append(query_rag(args.base_url, entry["question"], tenant_id))
        except Exception as exc:
            logger.warning("Query failed for %s: %s", entry["id"], exc)
            responses.append({"answer": "", "contexts": []})

    dataset = build_dataset(entries, responses)
    scores = run_ragas_metrics(dataset)
    summary = build_summary(entries, responses, scores)

    args.out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    logger.info("Wrote summary to %s", args.out)
    logger.info("Aggregate: %s", summary["aggregate"])

    if args.skip_threshold_check:
        return 0
    failures = check_thresholds(summary["aggregate"])
    if failures:
        logger.error("RAGAS thresholds failed: %s", ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
