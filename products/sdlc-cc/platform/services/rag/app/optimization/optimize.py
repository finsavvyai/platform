"""CLI entry point for running DSPy optimization on the top RAG flows.

Usage::

    python -m app.optimization.optimize [--golden PATH] [--out DIR] [--model NAME]

The script:

1. Loads the Wave 2 RAGAS golden set from ``services/rag/evals/golden_set.yaml``.
2. Configures DSPy with an LM (OpenAI or Anthropic) read from env vars.
3. For every module in :func:`app.optimization.modules.build_all` it runs
   :class:`dspy.teleprompt.BootstrapFewShot` against the golden set.
4. Saves each compiled program to ``app/optimization/optimized/<name>.json``.
5. Prints a before/after score table using the combined RAGAS metric.

Exit code is non-zero if the post-compile score regresses vs. the
uncompiled baseline, which makes this safe to drop into CI.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Callable

import yaml

THIS_DIR = Path(__file__).resolve().parent
DEFAULT_GOLDEN = THIS_DIR.parent.parent / "evals" / "golden_set.yaml"
DEFAULT_OUT = THIS_DIR / "optimized"


def _load_golden(path: Path) -> list[Any]:
    """Load the golden set and convert entries to ``dspy.Example`` objects."""
    import dspy
    raw = yaml.safe_load(path.read_text())
    examples: list[Any] = []
    for entry in raw.get("entries", []):
        ex = dspy.Example(
            query=entry["question"],
            question=entry["question"],
            expected_answer=entry["expected_answer"],
            context=" ".join(entry.get("expected_sources", []) or []),
            available_filters=json.dumps({"category": entry.get("category", "")}),
            intent=entry.get("category", "factual"),
        ).with_inputs("query", "question", "context", "available_filters")
        examples.append(ex)
    return examples


def _configure_lm(model: str | None) -> None:
    """Configure the DSPy default LM from environment variables."""
    import dspy
    name = model or os.getenv("DSPY_MODEL")
    if not name:
        if os.getenv("OPENAI_API_KEY"):
            name = "openai/gpt-4o-mini"
        elif os.getenv("ANTHROPIC_API_KEY"):
            name = "anthropic/claude-3-5-haiku-latest"
        else:
            raise RuntimeError(
                "No LM credentials found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY, "
                "or pass --model."
            )
    dspy.configure(lm=dspy.LM(name))


def _score(module: Any, examples: list[Any], metric: Callable[..., float]) -> float:
    """Average metric score for ``module`` over ``examples``."""
    if not examples:
        return 0.0
    total = 0.0
    for ex in examples:
        try:
            pred = module(**{k: ex[k] for k in ex.inputs().keys() if k in ex})
        except Exception:
            continue
        total += metric(ex, pred)
    return total / len(examples)


def _compile_module(module: Any, trainset: list[Any], metric: Callable[..., float]) -> Any:
    """Run BootstrapFewShot on a single module."""
    from dspy.teleprompt import BootstrapFewShot
    optimizer = BootstrapFewShot(metric=metric, max_bootstrapped_demos=4, max_labeled_demos=4)
    return optimizer.compile(module, trainset=trainset)


def main(argv: list[str] | None = None) -> int:
    """CLI main."""
    parser = argparse.ArgumentParser(description="Optimize SDLC RAG prompts with DSPy.")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--model", type=str, default=None)
    args = parser.parse_args(argv)

    _configure_lm(args.model)
    from app.optimization.metrics import combined_metric
    from app.optimization.modules import build_all

    examples = _load_golden(args.golden)
    print(f"Loaded {len(examples)} golden examples from {args.golden}")
    args.out.mkdir(parents=True, exist_ok=True)

    results: dict[str, tuple[float, float]] = {}
    regressed = False
    for name, module in build_all().items():
        print(f"\n== {name} ==")
        before = _score(module, examples, combined_metric)
        print(f"  baseline: {before:.3f}")
        compiled = _compile_module(module, examples, combined_metric)
        after = _score(compiled, examples, combined_metric)
        print(f"  compiled: {after:.3f}  ({'+' if after >= before else ''}{after - before:.3f})")
        target = args.out / f"{name}.json"
        try:
            compiled.save(str(target))
        except Exception as exc:
            print(f"  WARN: could not save {target}: {exc}")
        results[name] = (before, after)
        if after + 1e-6 < before:
            regressed = True

    print("\n=== Summary ===")
    for name, (b, a) in results.items():
        print(f"  {name:18s} {b:.3f} -> {a:.3f}")
    return 1 if regressed else 0


if __name__ == "__main__":
    sys.exit(main())
