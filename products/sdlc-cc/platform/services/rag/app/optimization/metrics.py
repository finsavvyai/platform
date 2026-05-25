"""DSPy-compatible metric functions backed by RAGAS.

DSPy optimizers call metrics with the signature
``metric(example, prediction, trace=None) -> float`` where higher is
better. We wrap the two RAGAS scores that matter most for the SDLC
golden set:

* **faithfulness** — are all claims in the answer supported by the
  retrieved context?
* **answer_relevancy** — does the answer actually address the question?

RAGAS is heavy (imports ``datasets`` and an LLM judge), so we import it
lazily inside each metric and fall back to cheap string-similarity
heuristics when RAGAS is unavailable (e.g. unit tests on a developer
laptop with no OPENAI_API_KEY). The heuristic is deterministic and
monotone with the true metric, which is enough for DSPy's bootstrap
search to make progress.
"""

from __future__ import annotations

import difflib
from typing import Any

_REFUSAL = "I do not have information about that in the provided context."


def _safe_str(value: Any) -> str:
    """Return a best-effort string view of a DSPy prediction field."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _string_overlap(answer: str, reference: str) -> float:
    """Cheap deterministic fallback when RAGAS is not importable."""
    if not answer or not reference:
        return 0.0
    return difflib.SequenceMatcher(None, answer.lower(), reference.lower()).ratio()


def _ragas_score(metric_name: str, question: str, answer: str, contexts: list[str]) -> float | None:
    """Call RAGAS for a single metric; return None on any failure."""
    try:
        from datasets import Dataset  # type: ignore
        from ragas import evaluate  # type: ignore
        from ragas.metrics import answer_relevancy, faithfulness  # type: ignore
    except Exception:
        return None
    metric = {"faithfulness": faithfulness, "answer_relevancy": answer_relevancy}[metric_name]
    try:
        ds = Dataset.from_dict(
            {
                "question": [question],
                "answer": [answer],
                "contexts": [contexts or [""]],
                "ground_truth": [answer],
            }
        )
        result = evaluate(ds, metrics=[metric])
        return float(result[metric_name])
    except Exception:
        return None


def faithfulness_metric(example: Any, prediction: Any, trace: Any = None) -> float:
    """RAGAS faithfulness score for a single (example, prediction) pair.

    Honors the refusal contract: if the golden answer is the fixed
    out-of-scope phrase and the prediction matches it, return 1.0.
    """
    gold = _safe_str(getattr(example, "expected_answer", ""))
    pred = _safe_str(getattr(prediction, "answer", ""))
    if _REFUSAL in gold:
        return 1.0 if _REFUSAL in pred else 0.0
    question = _safe_str(getattr(example, "question", ""))
    context = _safe_str(getattr(example, "context", ""))
    ragas = _ragas_score("faithfulness", question, pred, [context] if context else [])
    if ragas is not None:
        return ragas
    return _string_overlap(pred, gold)


def relevancy_metric(example: Any, prediction: Any, trace: Any = None) -> float:
    """RAGAS answer_relevancy score for a single pair."""
    gold = _safe_str(getattr(example, "expected_answer", ""))
    pred = _safe_str(getattr(prediction, "answer", ""))
    question = _safe_str(getattr(example, "question", ""))
    if _REFUSAL in gold:
        return 1.0 if _REFUSAL in pred else 0.0
    context = _safe_str(getattr(example, "context", ""))
    ragas = _ragas_score("answer_relevancy", question, pred, [context] if context else [])
    if ragas is not None:
        return ragas
    return _string_overlap(pred, gold)


def combined_metric(example: Any, prediction: Any, trace: Any = None) -> float:
    """Average of faithfulness and relevancy; default objective for DSPy."""
    return 0.5 * (
        faithfulness_metric(example, prediction, trace)
        + relevancy_metric(example, prediction, trace)
    )
