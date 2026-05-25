"""
Query Expansion

Query expansion with synonyms, related concepts, and boolean queries.
"""

import logging
from typing import List, Dict, Optional, Tuple

from .models import (
    QueryEntity,
    QueryTerm,
    ExpandedQuery,
    QueryContext,
)

logger = logging.getLogger(__name__)

SYNONYM_DICT = {
    "get": ["obtain", "retrieve", "fetch", "acquire"],
    "show": ["display", "present", "reveal", "demonstrate"],
    "find": ["locate", "search", "discover", "identify"],
    "create": ["make", "build", "generate", "develop"],
    "help": ["assist", "support", "aid", "guide"],
    "information": ["data", "details", "facts", "knowledge"],
    "problem": ["issue", "challenge", "difficulty", "obstacle"],
    "solution": ["answer", "resolution", "fix", "approach"],
}


async def expand_query(
    query: str,
    keywords: List[str],
    entities: List[QueryEntity],
    domain: Optional[str],
    context: Optional[QueryContext],
    domain_vocabulary: Dict[str, List[str]],
) -> ExpandedQuery:
    """Expand query with related terms and concepts."""
    try:
        synonyms = _generate_synonyms(keywords)
        related = _generate_related_concepts(
            keywords, domain, domain_vocabulary
        )
        weighted: List[Tuple[str, float]] = []
        for kw in keywords:
            w = 1.5 if any(
                e.text.lower() == kw.lower() for e in entities
            ) else 1.0
            weighted.append((kw, w))

        boolean_query = _create_boolean_query(keywords, synonyms, entities)

        expanded_terms = [
            QueryTerm(
                term=kw, weight=1.0, term_type="keyword",
                importance=0.8,
                synonyms=SYNONYM_DICT.get(kw.lower(), []),
                related_terms=_get_related_terms(kw, domain, domain_vocabulary),
            )
            for kw in keywords
        ]

        if len(synonyms) > len(keywords) * 0.5:
            method, conf = "semantic_expansion", 0.8
        elif related:
            method, conf = "conceptual_expansion", 0.7
        else:
            method, conf = "basic_expansion", 0.6

        return ExpandedQuery(
            original_query=query,
            expanded_terms=expanded_terms,
            related_concepts=related,
            synonyms=synonyms,
            boolean_query=boolean_query,
            weighted_terms=weighted,
            expansion_method=method,
            expansion_confidence=conf,
        )
    except Exception as e:
        logger.warning(f"Query expansion failed: {e}")
        return ExpandedQuery(
            original_query=query, expanded_terms=[],
            related_concepts=[], synonyms=[],
            boolean_query=query, weighted_terms=[],
            expansion_method="basic", expansion_confidence=0.5,
        )


def _generate_synonyms(keywords: List[str]) -> List[str]:
    synonyms = []
    for kw in keywords:
        if kw in SYNONYM_DICT:
            synonyms.extend(SYNONYM_DICT[kw])
    return list(set(synonyms))


def _generate_related_concepts(
    keywords: List[str],
    domain: Optional[str],
    domain_vocabulary: Dict[str, List[str]],
) -> List[str]:
    related = []
    if domain and domain in domain_vocabulary:
        vocab = domain_vocabulary[domain]
        for kw in keywords:
            for term in vocab:
                if term != kw and _are_related(kw, term):
                    related.append(term)
    return related


def _are_related(term1: str, term2: str) -> bool:
    if len(term1) >= 3 and len(term2) >= 3:
        return term1.startswith(term2[:3]) or term2.startswith(term1[:3])
    return False


def _create_boolean_query(
    keywords: List[str],
    synonyms: List[str],
    entities: List[QueryEntity],
) -> str:
    terms = list(keywords)
    for e in entities:
        et = [e.text] + e.synonyms
        if len(et) > 1:
            terms.append(f"({' OR '.join(et)})")
        else:
            terms.append(e.text)
    return " AND ".join(terms)


def _get_related_terms(
    term: str,
    domain: Optional[str],
    domain_vocabulary: Dict[str, List[str]],
) -> List[str]:
    if domain and domain in domain_vocabulary:
        return [
            dt for dt in domain_vocabulary[domain]
            if _are_related(term, dt)
        ]
    return []
