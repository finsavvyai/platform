"""
Citation Formatting

Style-specific citation formatting (APA, MLA, Chicago, IEEE, etc.).
"""

from typing import List

from .models import CitationMetadata, CitationType, CitationStyle


def format_apa(metadata: CitationMetadata) -> str:
    """Format citation in APA style."""
    authors = format_authors(metadata.authors, "apa")
    if metadata.citation_type == CitationType.JOURNAL_ARTICLE:
        cit = f"{authors} ({metadata.publication_year}). {metadata.title}. *{metadata.source}*, "
        if metadata.volume:
            cit += f"*{metadata.volume}*"
        if metadata.issue:
            cit += f"({metadata.issue}), "
        cit += f"{metadata.pages}." if metadata.pages else "."
    elif metadata.citation_type == CitationType.BOOK:
        cit = f"{authors} ({metadata.publication_year}). *{metadata.title}* ({metadata.edition} ed.). {metadata.publisher}."
    elif metadata.citation_type == CitationType.WEBSITE:
        cit = f"{authors} ({metadata.publication_date or metadata.publication_year}). *{metadata.title}*. {metadata.source}. {metadata.url}"
    else:
        cit = f"{authors} ({metadata.publication_year}). {metadata.title}. {metadata.source}."
    if metadata.doi:
        cit += f" https://doi.org/{metadata.doi}"
    return cit


def format_mla(metadata: CitationMetadata) -> str:
    """Format citation in MLA style."""
    authors = format_authors(metadata.authors, "mla")
    if metadata.citation_type == CitationType.JOURNAL_ARTICLE:
        return f'{authors}. "{metadata.title}." *{metadata.source}*, vol. {metadata.volume}, no. {metadata.issue}, {metadata.publication_year}, pp. {metadata.pages}.'
    elif metadata.citation_type == CitationType.BOOK:
        return f"{authors}. *{metadata.title}*. {metadata.publisher}, {metadata.publication_year}."
    elif metadata.citation_type == CitationType.WEBSITE:
        return f'{authors}. "{metadata.title}." *{metadata.source}*, {metadata.publication_date or metadata.publication_year}, {metadata.url}.'
    return f'{authors}. "{metadata.title}." *{metadata.source}*, {metadata.publication_year}.'


def format_chicago(metadata: CitationMetadata) -> str:
    """Format citation in Chicago style."""
    authors = format_authors(metadata.authors, "chicago")
    return f'{authors}. "{metadata.title}." {metadata.source} ({metadata.publication_year}).'


def format_ieee(metadata: CitationMetadata) -> str:
    """Format citation in IEEE style."""
    auth = format_ieee_authors(metadata.authors)
    return f'{auth}, "{metadata.title}," {metadata.source}, {metadata.publication_year}.'


def format_harvard(metadata: CitationMetadata) -> str:
    """Format citation in Harvard style."""
    authors = format_authors(metadata.authors, "harvard")
    return f'{authors} ({metadata.publication_year}) "{metadata.title}." {metadata.source}.'


def format_vancouver(metadata: CitationMetadata) -> str:
    """Format citation in Vancouver style."""
    authors = format_vancouver_authors(metadata.authors)
    return f"{authors}. {metadata.title}. {metadata.source}. {metadata.publication_year}."


def format_numeric(metadata: CitationMetadata) -> str:
    """Format citation in simple numeric style."""
    return format_apa(metadata)


def format_inline(metadata: CitationMetadata) -> str:
    """Format citation for inline use."""
    auth = metadata.authors[:2]
    if len(metadata.authors) > 2:
        auth.append("et al.")
    return f"({', '.join(auth)}, {metadata.publication_year})"


def fallback_format(metadata: CitationMetadata) -> str:
    """Fallback formatting."""
    auth = ", ".join(metadata.authors) if metadata.authors else "Unknown"
    return f"{auth}. {metadata.title}. {metadata.source}, {metadata.publication_year}."


def format_authors(authors: List[str], style: str) -> str:
    """Format author names according to citation style."""
    if not authors:
        return "Anonymous"
    if style == "apa":
        if len(authors) == 1: return authors[0]
        if len(authors) == 2: return f"{authors[0]} & {authors[1]}"
        return f"{authors[0]}, {authors[1]}, ..., {authors[-1]}"
    elif style == "mla":
        if len(authors) == 1: return authors[0]
        if len(authors) == 2: return f"{authors[0]} and {authors[1]}"
        return f"{authors[0]}, et al."
    elif style == "chicago":
        if len(authors) <= 2: return " and ".join(authors)
        return f"{authors[0]} et al."
    elif style == "harvard":
        if len(authors) <= 3: return ", ".join(authors)
        return f"{authors[0]} et al."
    return ", ".join(authors)


def format_ieee_authors(authors: List[str]) -> str:
    """Format authors for IEEE style."""
    if not authors:
        return "Anon."
    formatted = []
    for a in authors[:7]:
        parts = a.split()
        if len(parts) >= 2:
            formatted.append(f"{parts[0][0]}. {' '.join(parts[1:])}")
        else:
            formatted.append(a)
    if len(authors) > 7:
        formatted.append("et al.")
    return ", ".join(formatted)


def format_vancouver_authors(authors: List[str]) -> str:
    """Format authors for Vancouver style."""
    if not authors:
        return "Anonymous."
    if len(authors) <= 6:
        return ", ".join(authors)
    return ", ".join(authors[:6]) + ", et al."


FORMATTER_MAP = {
    CitationStyle.APA: format_apa,
    CitationStyle.MLA: format_mla,
    CitationStyle.CHICAGO: format_chicago,
    CitationStyle.IEEE: format_ieee,
    CitationStyle.HARVARD: format_harvard,
    CitationStyle.VANCOUVER: format_vancouver,
    CitationStyle.NUMERIC: format_numeric,
    CitationStyle.INLINE: format_inline,
}
