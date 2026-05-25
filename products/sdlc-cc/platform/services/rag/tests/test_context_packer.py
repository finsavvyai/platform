"""Tests for context_packer config, compress, and dedup modules."""


from app.context_packer import (
    PackingConfig,
    compress_chunk,
    deduplicate_chunks,
    estimate_tokens,
)


# --- PackingConfig ---

class TestPackingConfig:
    def test_defaults(self):
        cfg = PackingConfig()
        assert cfg.enabled is True
        assert cfg.max_tokens == 4096
        assert cfg.similarity_threshold == 0.9

    def test_from_env(self, monkeypatch):
        monkeypatch.setenv("CONTEXT_PACKING_ENABLED", "false")
        monkeypatch.setenv("CONTEXT_PACKING_MAX_TOKENS", "2048")
        monkeypatch.setenv("CONTEXT_PACKING_SIMILARITY_THRESHOLD", "0.8")
        cfg = PackingConfig.from_env()
        assert cfg.enabled is False
        assert cfg.max_tokens == 2048
        assert cfg.similarity_threshold == 0.8

    def test_from_env_defaults(self, monkeypatch):
        for key in [
            "CONTEXT_PACKING_ENABLED",
            "CONTEXT_PACKING_MAX_TOKENS",
            "CONTEXT_PACKING_SIMILARITY_THRESHOLD",
        ]:
            monkeypatch.delenv(key, raising=False)
        cfg = PackingConfig.from_env()
        assert cfg.enabled is True
        assert cfg.max_tokens == 4096


# --- estimate_tokens ---

class TestEstimateTokens:
    def test_empty_string(self):
        assert estimate_tokens("") == 0

    def test_short_string(self):
        assert estimate_tokens("hi") == 1

    def test_normal_string(self):
        assert estimate_tokens("a" * 100) == 25

    def test_none_returns_zero(self):
        assert estimate_tokens(None) == 0


# --- compress_chunk ---

class TestCompressChunk:
    def test_empty_input(self):
        assert compress_chunk("") == ""
        assert compress_chunk("   ") == ""
        assert compress_chunk(None) == ""

    def test_collapse_blank_lines(self):
        result = compress_chunk("line1\n\n\n\n\nline2")
        assert result == "line1\n\nline2"

    def test_collapse_spaces(self):
        assert compress_chunk("hello    world") == "hello world"

    def test_trailing_whitespace(self):
        assert compress_chunk("hello   \nworld") == "hello\nworld"

    def test_repeated_separators(self):
        result = compress_chunk("above\n---\n---\nbelow")
        assert result.count("---") == 1

    def test_repeated_lines(self):
        result = compress_chunk("header\nheader\ncontent")
        assert result == "header\ncontent"

    def test_preserves_different_lines(self):
        text = "line1\nline2\nline3"
        assert compress_chunk(text) == text


# --- deduplicate_chunks ---

class TestDeduplicateChunks:
    def test_empty_list(self):
        assert deduplicate_chunks([]) == []

    def test_single_chunk(self):
        assert deduplicate_chunks(["hello"]) == ["hello"]

    def test_no_duplicates(self):
        chunks = ["alpha", "beta", "gamma"]
        assert deduplicate_chunks(chunks) == chunks

    def test_exact_duplicates(self):
        chunks = ["hello world", "hello world", "goodbye"]
        result = deduplicate_chunks(chunks, similarity_threshold=0.9)
        assert len(result) == 2
        assert result[0] == "hello world"
        assert result[1] == "goodbye"

    def test_near_duplicates(self):
        chunks = [
            "The quick brown fox jumps over the lazy dog",
            "The quick brown fox jumps over the lazy cat",
            "Something completely different here",
        ]
        result = deduplicate_chunks(chunks, similarity_threshold=0.8)
        assert len(result) == 2

    def test_keeps_first_occurrence(self):
        result = deduplicate_chunks(["first", "first"])
        assert result == ["first"]
