"""
Query Extraction

Entity extraction, keyword extraction, temporal/numerical parsing.
"""

import re
from collections import Counter
from typing import List, Dict, Any, Tuple, Optional

from .models import QueryEntity


async def extract_entities(query: str, nlp=None) -> List[QueryEntity]:
    """Extract named entities from query."""
    entities = []
    try:
        if nlp:
            doc = nlp(query)
            for ent in doc.ents:
                entities.append(QueryEntity(
                    text=ent.text, label=ent.label_,
                    start=ent.start_char, end=ent.end_char,
                    confidence=0.8, canonical_form=ent.text.lower(),
                    context=query[max(0, ent.start_char - 20):ent.end_char + 20],
                ))
        if not entities:
            entities = extract_entities_patterns(query)
        entities = await enhance_entities(entities)
    except Exception:
        pass
    return entities


def extract_entities_patterns(query: str) -> List[QueryEntity]:
    """Fallback pattern-based entity extraction."""
    entities = []
    patterns = [
        (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "EMAIL", 0.9),
        (r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", "PHONE", 0.9),
        (r"https?://[^\s]+", "URL", 0.95),
        (r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b", "DATE", 0.8),
    ]
    for pat, label, conf in patterns:
        for m in re.finditer(pat, query):
            entities.append(QueryEntity(
                text=m.group(), label=label,
                start=m.start(), end=m.end(), confidence=conf,
            ))
    return entities


async def enhance_entities(
    entities: List[QueryEntity],
) -> List[QueryEntity]:
    """Enhance entities with additional information."""
    synonym_map = {
        "PERSON": ["person", "individual", "user"],
        "ORG": ["organization", "company", "business"],
        "GPE": ["location", "place", "country"],
    }
    for e in entities:
        e.synonyms = synonym_map.get(e.label, [])
        if e.canonical_form is None:
            e.canonical_form = e.text.lower().strip()
    return entities


def extract_key_terms(
    query: str,
) -> Tuple[List[str], List[str]]:
    """Extract keywords and key phrases from query."""
    stop_words = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at",
        "to", "for", "of", "with", "by", "is", "are", "was", "were",
        "be", "been", "have", "has", "had", "do", "does", "did",
        "will", "would", "could", "should", "may", "might", "can",
        "this", "that", "these", "those", "i", "you", "he", "she",
        "it", "we", "they", "me", "him", "her", "us", "them",
    }
    words = [
        w.lower() for w in query.split()
        if w.lower() not in stop_words and len(w) > 2
    ]
    keywords = [w for w, _ in Counter(words).most_common(10)]

    words_list = query.split()
    phrases = []
    for i in range(len(words_list) - 1):
        ph = " ".join(words_list[i:i + 2]).lower()
        if all(w not in stop_words for w in ph.split()):
            phrases.append(ph)
    for i in range(len(words_list) - 2):
        ph = " ".join(words_list[i:i + 3]).lower()
        if all(w not in stop_words for w in ph.split()):
            phrases.append(ph)
    key_phrases = [p for p, _ in Counter(phrases).most_common(5)]
    return keywords, key_phrases


def extract_temporal_expressions(query: str) -> List[str]:
    """Extract temporal expressions from query."""
    patterns = [
        r"\b\d{4}\b",
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
        r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b",
        r"\b(yesterday|today|tomorrow|now|soon|later)\b",
        r"\b(last|this|next)\s+(week|month|year|decade)\b",
    ]
    results = []
    for p in patterns:
        results.extend(re.findall(p, query, re.IGNORECASE))
    return results


def extract_numerical_values(query: str) -> List[Dict[str, Any]]:
    """Extract numerical values and their contexts."""
    vals = []
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)?", query):
        start = max(0, m.start() - 20)
        end = min(len(query), m.end() + 20)
        vals.append({
            "value": float(m.group(1)),
            "unit": m.group(2),
            "context": query[start:end].strip(),
            "position": m.start(),
        })
    return vals


def analyze_sentiment(query: str) -> str:
    """Analyze query sentiment."""
    positive = ["good", "great", "excellent", "amazing", "wonderful", "perfect", "love", "best"]
    negative = ["bad", "terrible", "awful", "horrible", "worst", "hate", "poor"]
    ql = query.lower()
    pc = sum(1 for w in positive if w in ql)
    nc = sum(1 for w in negative if w in ql)
    if pc > nc: return "positive"
    if nc > pc: return "negative"
    return "neutral"


def assess_urgency(query: str) -> str:
    """Assess query urgency."""
    words = ["urgent", "emergency", "immediately", "asap", "critical", "important", "priority", "quickly"]
    cnt = sum(1 for w in words if w in query.lower())
    if cnt >= 2: return "high"
    if cnt == 1: return "medium"
    return "normal"


def detect_domain(
    query: str,
    keywords: List[str],
    entities: List[QueryEntity],
    domain_vocabulary: Dict[str, List[str]],
) -> Optional[str]:
    """Detect query domain."""
    ql = query.lower()
    all_terms = keywords + [e.text.lower() for e in entities]
    scores = {}
    for domain, vocab in domain_vocabulary.items():
        s = sum(1 for t in vocab if t in ql)
        s += sum(1 for t in vocab if t in all_terms)
        scores[domain] = s
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else None
