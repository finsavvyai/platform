"""DSPy signatures for the top 3 SDLC RAG flows.

A signature is a *typed contract* — it declares the input and output fields
along with docstrings that DSPy uses as system-level task instructions. The
optimizer then attaches compiled few-shot demonstrations to these signatures
to improve quality without changing the surrounding Python code.

Three flows are in scope:

1. ``QueryClassifier``  — routes a user query to an intent bucket so the
   pipeline can skip expensive steps for out-of-scope queries.
2. ``RetrievalPlanner`` — decides which filters and ``top_k`` to use for
   vector search, given the query and the tenant's available filter catalog.
3. ``AnswerGenerator``  — generates a grounded answer with citations from
   retrieved context, matching the RAGAS faithfulness criterion.

All fields are typed. ``InputField`` and ``OutputField`` descriptions become
part of the compiled prompt, so keep them short and precise.
"""

from __future__ import annotations

import dspy


class QueryClassifier(dspy.Signature):
    """Classify a user query into one of the SDLC RAG intent buckets.

    Buckets match the RAGAS golden set: ``factual``, ``multi_hop``,
    ``out_of_scope``, ``compliance``. Confidence is a float in [0, 1].
    """

    query: str = dspy.InputField(
        desc="Raw user query as sent to the RAG /query endpoint."
    )
    intent: str = dspy.OutputField(
        desc="One of: factual, multi_hop, out_of_scope, compliance."
    )
    confidence: float = dspy.OutputField(
        desc="Model confidence in the chosen intent, between 0.0 and 1.0."
    )


class RetrievalPlanner(dspy.Signature):
    """Plan the retrieval step: choose metadata filters and top_k.

    The planner sees the query plus a JSON catalog of filters the tenant
    may legally apply (e.g. document_type, folder, classification). It
    returns a compact filter plan and a ``top_k`` budget. A smaller ``top_k``
    should be chosen for narrow queries to reduce cost and latency.
    """

    query: str = dspy.InputField(desc="User query to retrieve context for.")
    available_filters: str = dspy.InputField(
        desc="JSON object describing filters the tenant may apply."
    )
    filter_plan: str = dspy.OutputField(
        desc="JSON object of filters to apply, e.g. {\"doc_type\": \"policy\"}."
    )
    top_k: int = dspy.OutputField(
        desc="Integer number of chunks to retrieve, typically 3-12."
    )


class AnswerGenerator(dspy.Signature):
    """Generate a grounded answer with citations from retrieved context.

    The answer MUST only use information present in ``context``. If the
    context does not contain the answer, the model must reply with the
    exact phrase ``I do not have information about that in the provided
    context.`` Citations are a comma-separated list of source identifiers
    drawn from the context metadata.
    """

    query: str = dspy.InputField(desc="User question.")
    context: str = dspy.InputField(
        desc="Concatenated retrieved chunks with source headers."
    )
    answer: str = dspy.OutputField(
        desc="Grounded answer, or the fixed refusal string for out-of-scope."
    )
    citations: str = dspy.OutputField(
        desc="Comma-separated list of source identifiers used in the answer."
    )
