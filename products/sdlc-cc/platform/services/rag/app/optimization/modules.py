"""DSPy modules implementing each RAG signature.

A DSPy module is an executable program composed from one or more
``dspy.Predict`` or ``dspy.ChainOfThought`` predictors. Modules are what
get *compiled* by optimizers (BootstrapFewShot, MIPRO, etc.). After
compilation they behave exactly like ordinary Python callables but carry
tuned few-shot demonstrations inside their state.

We expose three modules matching ``signatures.py``:

* ``ClassifyQuery``  — ChainOfThought over :class:`QueryClassifier`.
* ``PlanRetrieval``  — ``Predict`` over :class:`RetrievalPlanner` (no CoT
  to keep latency low on the hot path).
* ``GenerateAnswer`` — ChainOfThought over :class:`AnswerGenerator` so the
  model can reason about grounding before emitting the final answer.
"""

from __future__ import annotations

from typing import Any

import dspy

from app.optimization.signatures import (
    AnswerGenerator,
    QueryClassifier,
    RetrievalPlanner,
)


class ClassifyQuery(dspy.Module):
    """Route a query to an intent bucket with a chain-of-thought rationale."""

    def __init__(self) -> None:
        super().__init__()
        self.classify = dspy.ChainOfThought(QueryClassifier)

    def forward(self, query: str) -> dspy.Prediction:
        """Run the classifier.

        Args:
            query: Raw user query string.

        Returns:
            A ``dspy.Prediction`` with ``intent`` and ``confidence`` fields.
        """
        return self.classify(query=query)


class PlanRetrieval(dspy.Module):
    """Choose filters and ``top_k`` for the vector search stage."""

    def __init__(self) -> None:
        super().__init__()
        self.plan = dspy.Predict(RetrievalPlanner)

    def forward(self, query: str, available_filters: str) -> dspy.Prediction:
        """Produce a retrieval plan.

        Args:
            query: User query.
            available_filters: JSON string of filters the tenant may use.

        Returns:
            A ``dspy.Prediction`` with ``filter_plan`` and ``top_k`` fields.
        """
        return self.plan(query=query, available_filters=available_filters)


class GenerateAnswer(dspy.Module):
    """Generate a grounded answer with citations from retrieved context.

    Uses ChainOfThought so the model can first enumerate which context
    spans support each claim before committing to a final answer. This
    correlates with higher RAGAS faithfulness scores in internal tests.
    """

    def __init__(self) -> None:
        super().__init__()
        self.generate = dspy.ChainOfThought(AnswerGenerator)

    def forward(self, query: str, context: str) -> dspy.Prediction:
        """Produce the final grounded answer.

        Args:
            query: User question.
            context: Concatenated retrieved chunks with source headers.

        Returns:
            A ``dspy.Prediction`` with ``answer`` and ``citations`` fields.
        """
        return self.generate(query=query, context=context)


def build_all() -> dict[str, Any]:
    """Factory: return a fresh instance of every optimization module.

    Used by :mod:`app.optimization.optimize` so the CLI does not have to
    know the concrete class names. The order matters — it maps to the
    names used for the compiled JSON artifacts on disk.
    """
    return {
        "classify_query": ClassifyQuery(),
        "plan_retrieval": PlanRetrieval(),
        "generate_answer": GenerateAnswer(),
    }
