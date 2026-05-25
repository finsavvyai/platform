"""
Post RAGAS evaluation scores to Langfuse.

Consumes the JSON summary produced by ``run_ragas.py`` and records each
per-question RAGAS metric as a Langfuse score on a dedicated eval trace.
Also records the aggregate values on a parent trace so nightly trends are
queryable from the Langfuse dashboard.

Runs only when Langfuse is enabled via env (see
``services/rag/app/observability/langfuse_client.py``). When disabled, this
script logs a warning and exits 0 so CI still succeeds.

Usage:
    python -m services.rag.evals.ragas_to_langfuse \
        --summary services/rag/evals/ragas_summary.json \
        --run-name "nightly-2026-04-08"
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

# Make the RAG service importable when running from the repo root.
_RAG_ROOT = Path(__file__).resolve().parents[1]
if str(_RAG_ROOT) not in sys.path:
    sys.path.insert(0, str(_RAG_ROOT))

from app.observability.langfuse_client import (  # noqa: E402
    flush,
    get_langfuse_client,
    is_langfuse_enabled,
)

logger = logging.getLogger("ragas_to_langfuse")

METRIC_NAMES = (
    "faithfulness",
    "answer_relevancy",
    "context_precision",
    "context_recall",
)


def load_summary(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _safe_score(client: Any, **kwargs: Any) -> None:
    """Call client.score defensively; never raise."""
    try:
        client.score(**kwargs)
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("Langfuse score call failed: %s", exc)


def post_summary(summary: Dict[str, Any], run_name: str) -> int:
    if not is_langfuse_enabled():
        logger.warning("Langfuse is disabled; skipping score upload")
        return 0

    client = get_langfuse_client()
    if client is None:
        logger.warning("Langfuse client unavailable; skipping score upload")
        return 0

    parent_name = f"ragas-eval:{run_name}"
    try:
        parent_trace = client.trace(
            name=parent_name,
            metadata={
                "dataset": summary.get("dataset"),
                "num_questions": summary.get("num_questions"),
                "thresholds": summary.get("thresholds"),
                "run_at": datetime.now(timezone.utc).isoformat(),
                "ci_commit": os.getenv("GITHUB_SHA"),
                "ci_run_id": os.getenv("GITHUB_RUN_ID"),
            },
            tags=["ragas", "eval", "nightly"],
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Failed to create parent Langfuse trace: %s", exc)
        parent_trace = None

    # Aggregate scores on the parent trace.
    aggregates: Dict[str, float] = summary.get("aggregate", {})
    if parent_trace is not None:
        for metric in METRIC_NAMES:
            if metric not in aggregates:
                continue
            _safe_score(
                client,
                trace_id=getattr(parent_trace, "id", None),
                name=f"ragas.aggregate.{metric}",
                value=float(aggregates[metric]),
                comment="Nightly aggregate across golden set",
            )

    # Per-question scores. One child trace per question keeps the UI useful.
    per_question = summary.get("per_question", []) or []
    posted = 0
    for row in per_question:
        qid = row.get("id", "unknown")
        try:
            trace = client.trace(
                name=f"ragas-eval:{run_name}:{qid}",
                input=row.get("question"),
                output=row.get("answer"),
                metadata={
                    "category": row.get("category"),
                    "num_contexts": row.get("num_contexts"),
                    "parent": parent_name,
                },
                tags=["ragas", "eval", row.get("category", "uncategorized")],
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("Failed to create child trace for %s: %s", qid, exc)
            continue

        scores = row.get("scores", {}) or {}
        for metric in METRIC_NAMES:
            if metric not in scores:
                continue
            _safe_score(
                client,
                trace_id=getattr(trace, "id", None),
                name=f"ragas.{metric}",
                value=float(scores[metric]),
                comment=f"Golden entry {qid}",
            )
        posted += 1

    flush()
    logger.info("Posted RAGAS scores for %d questions to Langfuse", posted)
    return 0


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Upload RAGAS scores to Langfuse.")
    parser.add_argument(
        "--summary",
        type=Path,
        default=Path(__file__).parent / "ragas_summary.json",
        help="Path to ragas_summary.json produced by run_ragas.py",
    )
    parser.add_argument(
        "--run-name",
        default=os.getenv("RAGAS_RUN_NAME", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        help="Human-readable name for this eval run",
    )
    args = parser.parse_args()

    if not args.summary.exists():
        logger.error("Summary file not found: %s", args.summary)
        return 2

    summary = load_summary(args.summary)
    return post_summary(summary, args.run_name)


if __name__ == "__main__":
    sys.exit(main())
