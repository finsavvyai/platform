"""
Sparse Search (BM25-style)

Keyword-based search using TF-IDF with BM25 saturation for scoring
document relevance against a query.
"""

import math
from collections import defaultdict
from typing import Dict, List, Tuple

from .types import ScoredResult

# Stopwords to filter during tokenization
_STOP_WORDS = frozenset(
    {"the", "a", "an", "is", "are", "was", "were", "in", "on",
     "at", "to", "for", "of", "and", "or", "not", "it", "this",
     "that", "with", "by", "from", "as", "be", "has", "had",
     "have", "do", "does", "did", "but", "if", "so", "no", "yes"}
)


def tokenize(text: str) -> List[str]:
    """Whitespace + lowercase tokenizer with stopword removal."""
    tokens = text.lower().split()
    return [t for t in tokens if len(t) > 1 and t not in _STOP_WORDS]


def sparse_search(
    query: str,
    documents: List[Dict],
    top_k: int = 30,
) -> List[ScoredResult]:
    """BM25-style keyword search using TF-IDF scoring.

    Args:
        query: search query text.
        documents: list of dicts, each with 'doc_id', 'content',
                   and optional 'metadata', 'chunk_id', 'document_id'.
        top_k: max results to return.

    Returns:
        Scored results sorted by descending relevance.
    """
    if not documents or not query.strip():
        return []

    query_terms = tokenize(query)
    if not query_terms:
        return []

    doc_count = len(documents)
    df: Dict[str, int] = defaultdict(int)
    doc_term_freqs: List[Tuple[Dict, Dict[str, int]]] = []

    for doc in documents:
        tokens = tokenize(doc.get("content", ""))
        tf: Dict[str, int] = defaultdict(int)
        for t in tokens:
            tf[t] += 1
        doc_term_freqs.append((doc, tf))
        for term in set(tf.keys()):
            df[term] += 1

    # BM25 parameters
    k1, b, avg_dl = 1.5, 0.75, 200

    scored: List[ScoredResult] = []
    for doc, tf in doc_term_freqs:
        score = 0.0
        doc_len = sum(tf.values()) or 1
        for term in query_terms:
            if term not in tf:
                continue
            term_freq = tf[term]
            idf = math.log((doc_count + 1) / (df.get(term, 0) + 1)) + 1
            numerator = term_freq * (k1 + 1)
            denominator = term_freq + k1 * (1 - b + b * doc_len / avg_dl)
            score += idf * (numerator / denominator)

        if score > 0:
            scored.append(
                ScoredResult(
                    doc_id=doc.get("doc_id", ""),
                    score=score,
                    content=doc.get("content", ""),
                    metadata=doc.get("metadata", {}),
                    chunk_id=doc.get("chunk_id"),
                    document_id=doc.get("document_id"),
                    source="sparse",
                )
            )

    scored.sort(key=lambda r: r.score, reverse=True)
    return scored[:top_k]
