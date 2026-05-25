"""
Citation Extraction

Extract and parse citations from document content.
"""

import re
import hashlib
import logging
from typing import List, Dict, Any, Optional

from app.models.document import DocumentChunk

from .models import (
    Citation,
    CitationMetadata,
    CitationType,
)

logger = logging.getLogger(__name__)

CITATION_PATTERNS = [
    r"(?:doi:|DOI:)?\s*(10\.\d+/.+?)(?:\s|$|\.)",
    r"(?:arxiv:|arXiv:)?\s*(\d{4}\.\d{4,5}(?:v\d+)?)",
    r"(?:pmid:|PMID:)?\s*(\d+)",
    r"(?:https?:\/\/|www\.)[^\s\)]+(?:\s|$|\.)",
    r"\(([A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+)*,\s*\d{4})\)",
    r"\[(\d+)\]",
    r'["""]([^"""]+)["""]',
]


async def extract_citations(
    chunk: DocumentChunk,
    context: Optional[str],
    metadata_cache: Dict[str, CitationMetadata],
) -> List[Citation]:
    """Extract citations from chunk content."""
    citations = []
    content = chunk.content + (f"\n{context}" if context else "")

    for pattern in CITATION_PATTERNS:
        for match in re.finditer(pattern, content, re.IGNORECASE):
            text = match.group(1) if match.groups() else match.group(0)
            meta = await parse_citation_text(text, content, metadata_cache)
            if meta:
                citations.append(
                    Citation(metadata=meta, source_chunks=[chunk.id])
                )

    if chunk.metadata:
        mc = extract_from_metadata(chunk.metadata)
        if mc:
            citations.append(mc)

    return citations


async def parse_citation_text(
    citation_text: str,
    full_text: str,
    metadata_cache: Dict[str, CitationMetadata],
) -> Optional[CitationMetadata]:
    """Parse citation text to extract metadata."""
    try:
        cache_key = hashlib.md5(citation_text.encode()).hexdigest()
        if cache_key in metadata_cache:
            return metadata_cache[cache_key]

        meta = CitationMetadata(title=citation_text)

        doi_match = re.search(r"10\.\d+/.+", citation_text)
        if doi_match:
            meta.doi = doi_match.group(0)

        arxiv_match = re.search(r"\d{4}\.\d{4,5}(?:v\d+)?", citation_text)
        if arxiv_match:
            meta.arxiv_id = arxiv_match.group(0)
            meta.citation_type = CitationType.PREPRINT

        url_match = re.search(r"https?://[^\s]+", citation_text)
        if url_match:
            meta.url = url_match.group(0)
            meta.citation_type = CitationType.WEBSITE

        if not meta.doi and not meta.url:
            titles = extract_title_candidates(citation_text)
            if titles:
                meta.title = titles[0]

        authors = extract_authors(citation_text)
        if authors:
            meta.authors = authors

        year_match = re.search(r"\b(19|20)\d{2}\b", citation_text)
        if year_match:
            meta.publication_year = int(year_match.group(0))

        metadata_cache[cache_key] = meta
        return meta

    except Exception as e:
        logger.warning(f"Failed to parse citation text: {e}")
        return None


def extract_title_candidates(citation_text: str) -> List[str]:
    """Extract possible title candidates from citation text."""
    titles = []
    for pat in [r'["""]([^"""]+)["""]', r'"([^"]+)"', r"'([^']+)'"]:
        titles.extend(re.findall(pat, citation_text))
    for m in re.findall(
        r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5})\b", citation_text
    ):
        if 10 < len(m) < 100:
            titles.append(m)
    return titles[:3]


def extract_authors(citation_text: str) -> List[str]:
    """Extract author names from citation text."""
    authors = []
    patterns = [
        r"([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
        r"([A-Z]\.\s*[A-Z][a-z]+)",
    ]
    for pat in patterns:
        for m in re.findall(pat, citation_text):
            if len(m) > 3 and m not in authors:
                authors.append(m)
    cleaned = []
    for a in authors:
        if " and " in a:
            cleaned.extend(a.split(" and "))
        else:
            cleaned.append(a)
    return cleaned[:5]


def extract_from_metadata(
    metadata: Dict[str, Any],
) -> Optional[Citation]:
    """Extract citation from chunk metadata."""
    if not metadata:
        return None
    cm = CitationMetadata()
    mapping = {
        "title": "title", "authors": "authors", "source": "source",
        "publication_year": "publication_year", "doi": "doi",
        "url": "url", "isbn": "isbn", "publisher": "publisher",
    }
    for mf, cf in mapping.items():
        if mf in metadata:
            setattr(cm, cf, metadata[mf])
    if "citation_type" in metadata:
        cm.citation_type = CitationType(metadata["citation_type"])
    elif metadata.get("source_type") == "journal":
        cm.citation_type = CitationType.JOURNAL_ARTICLE
    elif metadata.get("source_type") == "book":
        cm.citation_type = CitationType.BOOK
    if cm.title or cm.doi or cm.url:
        return Citation(metadata=cm, source_chunks=[])
    return None
