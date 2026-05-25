"""
Context Packer - Chunk compression utilities.

Removes redundant whitespace, repeated headers/footers,
boilerplate patterns, and redundant separators from text chunks.
"""

import re


def estimate_tokens(text: str) -> int:
    """Estimate token count using chars/4 heuristic."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def compress_chunk(text: str) -> str:
    """
    Compress a single chunk by removing redundant content.

    Removes:
    - Excessive whitespace and blank lines
    - Repeated headers/footers
    - Common boilerplate patterns
    - Redundant separators
    """
    if not text or not text.strip():
        return ""

    result = text

    # Collapse multiple blank lines to single
    result = re.sub(r"\n{3,}", "\n\n", result)

    # Collapse multiple spaces to single
    result = re.sub(r"[ \t]{2,}", " ", result)

    # Remove trailing whitespace per line
    result = re.sub(r"[ \t]+\n", "\n", result)

    # Remove repeated separator lines (---, ===, ***)
    result = re.sub(r"([-=*]{3,}\n){2,}", r"\1", result)

    # Remove repeated identical lines (headers/footers)
    result = _remove_repeated_lines(result)

    # Strip leading/trailing whitespace
    result = result.strip()

    return result


def _remove_repeated_lines(text: str) -> str:
    """Remove consecutive duplicate lines."""
    lines = text.split("\n")
    if len(lines) <= 1:
        return text

    deduped: list[str] = [lines[0]]
    for line in lines[1:]:
        stripped = line.strip()
        if stripped and stripped == deduped[-1].strip():
            continue
        deduped.append(line)

    return "\n".join(deduped)
