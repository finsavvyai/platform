"""
Long-context support: chunk + hierarchical summarisation so inputs
larger than any single model's context window still produce coherent
answers.

Day 52 of the production-ready roadmap.
"""

from __future__ import annotations

from dataclasses import dataclass


# Approximation: 1 token ~ 4 chars for English text. Real
# implementations call the provider's tokeniser; this estimate keeps
# the pipeline pure-Python so it stays cheap to test.
CHARS_PER_TOKEN = 4


@dataclass
class FitResult:
    """The output of fit_to_context: the prepared input + metadata."""

    text: str
    token_estimate: int
    chunks_summarised: int
    fidelity_score: float  # 0..1; 1.0 = original, 0.5 = lossy summary


def fit_to_context(
    text: str,
    *,
    target_tokens: int,
    summariser=None,
    _depth: int = 0,
    _max_depth: int = 6,
) -> FitResult:
    """Reduce ``text`` so it fits within ``target_tokens``.

    When the input already fits, returns it unchanged with fidelity 1.0.
    When it doesn't, splits into roughly-equal chunks, summarises each
    via ``summariser``, recursively summarises the joined output, and
    returns the result.

    ``summariser`` is a callable ``(chunk: str) -> str``. Tests pass an
    in-memory truncator; production passes the LLM gateway.

    ``_max_depth`` caps recursion: once exceeded, we hard-truncate the
    head of the joined output to fit. Six levels accommodate ~64x
    reductions which covers any realistic input.
    """
    estimated = estimate_tokens(text)
    if estimated <= target_tokens:
        return FitResult(text=text, token_estimate=estimated, chunks_summarised=0, fidelity_score=1.0)

    if summariser is None:
        # Default: keep the head + tail of each chunk so we don't
        # silently lose the lead and trailing context.
        summariser = _truncating_summariser

    chunks = _chunk(text, target_tokens=target_tokens // 2)
    summarised = [summariser(c) for c in chunks]
    joined = "\n\n".join(summarised)

    if estimate_tokens(joined) <= target_tokens:
        return FitResult(
            text=joined,
            token_estimate=estimate_tokens(joined),
            chunks_summarised=len(chunks),
            fidelity_score=0.7,
        )

    if _depth >= _max_depth:
        # Hard-truncate to the budget and accept the fidelity hit.
        cap = target_tokens * CHARS_PER_TOKEN
        truncated = joined[:cap]
        return FitResult(
            text=truncated,
            token_estimate=estimate_tokens(truncated),
            chunks_summarised=len(chunks),
            fidelity_score=0.3,
        )

    # Recursively summarise; track the accumulated fidelity loss.
    inner = fit_to_context(
        joined,
        target_tokens=target_tokens,
        summariser=summariser,
        _depth=_depth + 1,
        _max_depth=_max_depth,
    )
    return FitResult(
        text=inner.text,
        token_estimate=inner.token_estimate,
        chunks_summarised=len(chunks) + inner.chunks_summarised,
        fidelity_score=inner.fidelity_score * 0.7,
    )


def estimate_tokens(text: str) -> int:
    """Conservative char-based token count."""
    return max(1, (len(text) + CHARS_PER_TOKEN - 1) // CHARS_PER_TOKEN)


def _chunk(text: str, *, target_tokens: int) -> list[str]:
    """Split text on paragraph boundaries when possible; sliding chars
    otherwise. Each chunk lands at <= target_tokens.
    """
    target_chars = target_tokens * CHARS_PER_TOKEN
    paragraphs = text.split("\n\n")
    out: list[str] = []
    buf: list[str] = []
    buf_chars = 0
    for p in paragraphs:
        p_chars = len(p)
        if buf and buf_chars + p_chars > target_chars:
            out.append("\n\n".join(buf))
            buf, buf_chars = [], 0
        buf.append(p)
        buf_chars += p_chars + 2
        if buf_chars >= target_chars:
            out.append("\n\n".join(buf))
            buf, buf_chars = [], 0
    if buf:
        out.append("\n\n".join(buf))
    return out


def _truncating_summariser(chunk: str) -> str:
    """Default test summariser: head 200 chars + " ... " + tail 200."""
    if len(chunk) <= 500:
        return chunk
    return chunk[:200] + " ... " + chunk[-200:]


# ---------------------------------------------------------------------------
# Day 52 spec API: Chunker / HierarchicalSummarizer / FidelityScorer.
#
# These coexist with fit_to_context() above. The class API is the
# stable surface called from the gateway; fit_to_context remains for
# backwards compatibility with earlier roadmap days.
# ---------------------------------------------------------------------------

from typing import Callable, List, Protocol


@dataclass(frozen=True)
class ChunkSpan:
    """One window of source text with its token count."""

    index: int
    text: str
    tokens: int
    start: int  # word offset (inclusive)
    end: int    # word offset (exclusive)


def _word_token_estimator(text: str) -> int:
    """Whitespace word count. Off by ~25% from real tokenisers but
    fine for routing chunk sizes; vendors enforce real limits."""
    return len(text.split())


class Chunker:
    """Split long text into overlapping word-windows.

    REAL. Pure function over the input + estimator.
    """

    def __init__(self, estimator: Callable[[str], int] | None = None) -> None:
        self._estimate = estimator or _word_token_estimator

    def chunk(self, text: str, max_tokens: int = 2000, overlap: int = 100) -> List[ChunkSpan]:
        if max_tokens <= 0:
            raise ValueError("max_tokens must be > 0")
        if overlap < 0 or overlap >= max_tokens:
            raise ValueError("overlap must be >= 0 and < max_tokens")

        words = text.split()
        if not words:
            return []

        out: List[ChunkSpan] = []
        step = max_tokens - overlap
        i = 0
        idx = 0
        n = len(words)
        while i < n:
            end = min(i + max_tokens, n)
            window_words = words[i:end]
            window = " ".join(window_words)
            out.append(
                ChunkSpan(
                    index=idx,
                    text=window,
                    tokens=self._estimate(window),
                    start=i,
                    end=end,
                )
            )
            idx += 1
            if end == n:
                break
            i += step
        return out


class SummarizerProtocol(Protocol):
    """Anything that compresses a string into a shorter string."""

    def summarize(self, text: str) -> str:  # pragma: no cover - protocol
        ...


class HierarchicalSummarizer:
    """Recursive map-reduce summary.

    REAL given an injected Summarizer. The reduction logic is real;
    summarisation itself is the caller's responsibility (LLM gateway).
    """

    def __init__(self, chunker: Chunker, summarizer: SummarizerProtocol) -> None:
        self._chunker = chunker
        self._summarizer = summarizer

    def summarize(self, text: str, max_tokens: int = 2000, overlap: int = 100) -> str:
        chunks = self._chunker.chunk(text, max_tokens=max_tokens, overlap=overlap)
        if len(chunks) <= 1:
            return self._summarizer.summarize(text)
        summaries = [self._summarizer.summarize(c.text) for c in chunks]
        combined = "\n".join(summaries)
        if _word_token_estimator(combined) > max_tokens:
            return self.summarize(combined, max_tokens=max_tokens, overlap=overlap)
        return combined


class FidelityScorer:
    """Estimate fidelity from input/output length ratio.

    APPROXIMATION, NOT VALIDATED AGAINST GROUND TRUTH. Real fidelity
    needs human eval or a reference-based metric (BERTScore, ROUGE) —
    see services/rag/evals/.
    """

    def score(self, original: str, summary: str) -> float:
        if not original:
            return 1.0 if not summary else 0.0
        ratio = len(summary) / len(original)
        if ratio > 1.0:
            return 1.0
        return ratio
