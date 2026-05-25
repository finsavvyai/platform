"""Tests for the Day 52 long-context module.

Covers Chunker boundary behaviour, recursive HierarchicalSummarizer
reduction with a fake summariser, and FidelityScorer monotonicity.
"""

from __future__ import annotations

import pytest

from app.services.long_context import (
    Chunker,
    ChunkSpan,
    FidelityScorer,
    HierarchicalSummarizer,
)


# ---------------------------------------------------------------------------
# Chunker
# ---------------------------------------------------------------------------


class TestChunker:
    def test_empty_input_returns_no_chunks(self):
        c = Chunker()
        assert c.chunk("", max_tokens=10, overlap=2) == []

    def test_single_chunk_when_text_fits(self):
        c = Chunker()
        out = c.chunk("alpha beta gamma", max_tokens=10, overlap=2)
        assert len(out) == 1
        assert out[0].text == "alpha beta gamma"
        assert out[0].start == 0 and out[0].end == 3

    def test_overlap_handling(self):
        c = Chunker()
        text = " ".join(f"w{i}" for i in range(10))
        out = c.chunk(text, max_tokens=4, overlap=1)
        # Step = 3. Windows: [0..4), [3..7), [6..10). The third window
        # already covers the tail, so the chunker stops — anything
        # further would just repeat already-covered words.
        starts = [ch.start for ch in out]
        assert starts == [0, 3, 6]
        # First chunk ends at 4, second starts at 3 → overlap of 1 word
        assert out[0].end == 4
        assert out[1].start == 3
        # Final chunk reaches the end of the text.
        assert out[-1].end == 10

    def test_exactly_at_boundary(self):
        c = Chunker()
        # 6 words, max_tokens=3, overlap=0 → exactly 2 non-overlapping chunks
        text = "a b c d e f"
        out = c.chunk(text, max_tokens=3, overlap=0)
        assert len(out) == 2
        assert out[0].text == "a b c"
        assert out[1].text == "d e f"

    def test_invalid_overlap_raises(self):
        c = Chunker()
        with pytest.raises(ValueError):
            c.chunk("a b c", max_tokens=2, overlap=2)
        with pytest.raises(ValueError):
            c.chunk("a b c", max_tokens=0, overlap=0)

    def test_custom_estimator(self):
        # Estimator: 1 token per character.
        c = Chunker(estimator=lambda s: len(s))
        out: list[ChunkSpan] = c.chunk("hello world", max_tokens=100, overlap=0)
        assert out[0].tokens == len("hello world")


# ---------------------------------------------------------------------------
# HierarchicalSummarizer
# ---------------------------------------------------------------------------


class FakeSummarizer:
    """Prepends 'S:' so we can verify each level of reduction ran."""

    def __init__(self):
        self.calls = 0

    def summarize(self, text: str) -> str:
        self.calls += 1
        # Drop half the words to force eventual termination.
        words = text.split()
        kept = words[: max(1, len(words) // 2)]
        return "S:" + " ".join(kept)


class TestHierarchicalSummarizer:
    def test_short_input_one_call(self):
        fake = FakeSummarizer()
        h = HierarchicalSummarizer(Chunker(), fake)
        out = h.summarize("hello world", max_tokens=100, overlap=10)
        assert out.startswith("S:")
        assert fake.calls == 1

    def test_recursive_reduction(self):
        fake = FakeSummarizer()
        h = HierarchicalSummarizer(Chunker(), fake)
        # 50 words, max=10, overlap=2 → multiple chunks → recursion.
        text = " ".join(f"w{i}" for i in range(50))
        out = h.summarize(text, max_tokens=10, overlap=2)
        assert "S:" in out
        # First level produced multiple chunks → > 1 summariser call.
        assert fake.calls > 1


# ---------------------------------------------------------------------------
# FidelityScorer
# ---------------------------------------------------------------------------


class TestFidelityScorer:
    def test_empty_inputs(self):
        s = FidelityScorer()
        assert s.score("", "") == 1.0
        assert s.score("", "abc") == 0.0

    def test_lossless_is_one(self):
        s = FidelityScorer()
        assert s.score("hello", "hello") == 1.0

    def test_monotonic_in_summary_length(self):
        s = FidelityScorer()
        original = "a" * 100
        scores = [s.score(original, "a" * n) for n in (10, 25, 50, 75, 100)]
        # Strictly increasing.
        assert scores == sorted(scores)
        assert scores[0] < scores[-1]

    def test_summary_longer_than_original_clamps_to_one(self):
        s = FidelityScorer()
        assert s.score("ab", "abcdef") == 1.0
