"""Tests for the Day-52 long-context fitter."""

from __future__ import annotations

from app.services.long_context import (
    estimate_tokens,
    fit_to_context,
)


def test_fits_short_input_unchanged() -> None:
    short = "hello world"
    out = fit_to_context(short, target_tokens=1000)
    assert out.text == short
    assert out.fidelity_score == 1.0
    assert out.chunks_summarised == 0


def test_chunks_long_input() -> None:
    paragraphs = ["This is paragraph " + str(i) + ". " * 50 for i in range(20)]
    long_input = "\n\n".join(paragraphs)
    out = fit_to_context(long_input, target_tokens=200)
    assert out.chunks_summarised > 0
    assert out.fidelity_score < 1.0
    assert out.token_estimate <= 200 * 1.05  # allow a tiny rounding margin


def test_uses_provided_summariser() -> None:
    def crusher(chunk: str) -> str:
        return "C"

    long_input = "x" * 10_000
    out = fit_to_context(long_input, target_tokens=50, summariser=crusher)
    assert "C" in out.text
    assert out.fidelity_score < 1.0


def test_estimate_tokens_handles_empty() -> None:
    assert estimate_tokens("") == 1


def test_estimate_tokens_grows_with_text() -> None:
    assert estimate_tokens("a") < estimate_tokens("a" * 100) < estimate_tokens("a" * 10_000)


def test_recursive_summarisation_terminates() -> None:
    # Even a pathological 1MB input should terminate without
    # exploding the recursion stack.
    out = fit_to_context("x" * 1_000_000, target_tokens=100)
    assert out.token_estimate <= 200  # generous upper bound
    assert out.fidelity_score < 1.0
