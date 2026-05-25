"""Tests for context_packer pack_context and pack_and_compress."""


from app.context_packer import (
    PackingConfig,
    estimate_tokens,
    pack_and_compress,
    pack_context,
)


# --- pack_context ---

class TestPackContext:
    def test_empty_input(self):
        assert pack_context([]) == []

    def test_single_chunk_within_budget(self):
        result = pack_context(["hello"], max_tokens=100)
        assert result == ["hello"]

    def test_merges_small_chunks(self):
        chunks = ["a" * 10, "b" * 10, "c" * 10]
        result = pack_context(chunks, max_tokens=100)
        assert len(result) == 1
        assert "a" * 10 in result[0]
        assert "b" * 10 in result[0]

    def test_splits_on_budget(self):
        chunks = ["a" * 40, "b" * 40]  # 10 + 10 tokens
        result = pack_context(chunks, max_tokens=12)
        assert len(result) == 2

    def test_truncates_oversized_chunk(self):
        big = "x" * 1000  # 250 tokens
        result = pack_context([big], max_tokens=50)
        assert len(result) == 1
        assert estimate_tokens(result[0]) <= 50

    def test_custom_token_fn(self):
        def word_count(t):
            return len(t.split())
        chunks = ["one two three", "four five"]
        result = pack_context(chunks, max_tokens=4, token_fn=word_count)
        assert len(result) == 2

    def test_skips_empty_chunks(self):
        result = pack_context(["", "hello", ""], max_tokens=100)
        assert len(result) == 1
        assert result[0] == "hello"


# --- pack_and_compress ---

class TestPackAndCompress:
    def test_disabled_returns_original(self):
        cfg = PackingConfig(enabled=False)
        chunks = ["hello", "world"]
        result = pack_and_compress(chunks, config=cfg)
        assert result == chunks

    def test_empty_input(self):
        result = pack_and_compress([])
        assert result == []

    def test_compresses_whitespace(self):
        chunks = ["hello    world\n\n\n\nfoo"]
        cfg = PackingConfig(enabled=True, max_tokens=1000)
        result = pack_and_compress(chunks, config=cfg)
        assert "    " not in result[0]

    def test_removes_duplicates(self):
        chunks = ["identical text here", "identical text here", "unique"]
        cfg = PackingConfig(enabled=True, max_tokens=1000)
        result = pack_and_compress(chunks, config=cfg)
        packed_text = " ".join(result)
        assert packed_text.count("identical text here") == 1

    def test_respects_token_budget(self):
        chunks = ["a" * 200, "b" * 200, "c" * 200]
        cfg = PackingConfig(enabled=True, max_tokens=60)
        result = pack_and_compress(chunks, config=cfg)
        for packed in result:
            assert estimate_tokens(packed) <= 60

    def test_full_pipeline_reduces_tokens(self):
        chunks = [
            "The   quick  brown   fox  jumps  over  the  lazy  dog.",
            "The quick brown fox jumps over the lazy dog.",
            "A completely different and unique paragraph of text.",
        ]
        cfg = PackingConfig(
            enabled=True, max_tokens=1000, similarity_threshold=0.85
        )
        result = pack_and_compress(chunks, config=cfg)
        original_tokens = sum(estimate_tokens(c) for c in chunks)
        packed_tokens = sum(estimate_tokens(c) for c in result)
        assert packed_tokens < original_tokens

    def test_whitespace_only_chunks_removed(self):
        chunks = ["   ", "\n\n\n", "real content"]
        cfg = PackingConfig(enabled=True, max_tokens=1000)
        result = pack_and_compress(chunks, config=cfg)
        assert len(result) == 1
        assert "real content" in result[0]
