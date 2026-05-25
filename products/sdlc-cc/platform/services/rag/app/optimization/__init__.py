"""DSPy-based prompt optimization layer for the top SDLC RAG flows.

This package treats the three hottest RAG flows — query classification,
retrieval planning, and grounded answer generation — as DSPy programs rather
than hand-tuned prompt strings. The optimizer uses the Wave 2 RAGAS golden set
as training data and compiles improved few-shot demonstrations into JSON files
under ``optimized/``.

Exports:
    * Signatures describing typed input/output contracts for each flow.
    * ``dspy.Module`` subclasses that execute those signatures.
    * RAGAS-backed metric functions used by the BootstrapFewShot optimizer.
"""

from app.optimization.signatures import (
    AnswerGenerator,
    QueryClassifier,
    RetrievalPlanner,
)
from app.optimization.modules import (
    ClassifyQuery,
    GenerateAnswer,
    PlanRetrieval,
)
from app.optimization.metrics import faithfulness_metric, relevancy_metric

__all__ = [
    "QueryClassifier",
    "RetrievalPlanner",
    "AnswerGenerator",
    "ClassifyQuery",
    "PlanRetrieval",
    "GenerateAnswer",
    "faithfulness_metric",
    "relevancy_metric",
]
