# Wave 6 — DSPy Prompt Optimization

[DSPy](https://github.com/stanfordnlp/dspy) (Stanford NLP) is the framework
that lets us treat the top SDLC RAG flows as *programs*, not
prompt strings. You define typed signatures, compose them into modules,
and then hand DSPy a metric plus a training set — the optimizer searches
for the best few-shot demonstrations (and, optionally, the best
instructions) automatically.

This wave adds a DSPy-based optimization layer for the three hottest
RAG flows and wires it to the Wave 2 RAGAS golden set so every re-run
can ratchet faithfulness and answer_relevancy upward with zero manual
prompt tinkering.

## What DSPy does (program, not prompt)

Traditional prompt engineering looks like this::

    prompt = f"You are a helpful RAG assistant. Answer using only the context below.\n\nContext: {ctx}\n\nQ: {q}\nA:"

Every tweak is a guess. There is no metric, no training loop, no
regression guard. DSPy replaces the string with a typed program::

    class AnswerGenerator(dspy.Signature):
        """Answer grounded in context only; refuse otherwise."""
        query: str = dspy.InputField()
        context: str = dspy.InputField()
        answer: str = dspy.OutputField()
        citations: str = dspy.OutputField()

    class GenerateAnswer(dspy.Module):
        def __init__(self):
            super().__init__()
            self.generate = dspy.ChainOfThought(AnswerGenerator)
        def forward(self, query, context):
            return self.generate(query=query, context=context)

The program is *compiled* by an optimizer against a metric. The
compiled artifact contains tuned few-shot exemplars chosen to maximize
the metric — these are exported to JSON and loaded at runtime.

## File layout

```
services/rag/app/optimization/
├── __init__.py         # exports
├── signatures.py       # QueryClassifier / RetrievalPlanner / AnswerGenerator
├── modules.py          # ClassifyQuery / PlanRetrieval / GenerateAnswer
├── metrics.py          # RAGAS-backed faithfulness + relevancy metrics
├── optimize.py         # CLI: python -m app.optimization.optimize
└── optimized/          # compiled JSON artifacts (generated)
```

All files are strictly under 200 lines per the portfolio rule.

## The three flows

1. **QueryClassifier** — routes a query to `factual`, `multi_hop`,
   `out_of_scope`, or `compliance`. Lets the pipeline skip retrieval
   for OOS queries and cuts cost.
2. **RetrievalPlanner** — picks metadata filters and `top_k` given the
   query and the tenant's legal filter catalog.
3. **AnswerGenerator** — generates the final grounded answer and
   citations. This is where RAGAS faithfulness gains matter most.

## How optimization works (BootstrapFewShot walkthrough)

BootstrapFewShot is the simplest DSPy optimizer and the right default
for a small golden set (the Wave 2 set has ~22 entries).

1. Run the uncompiled module on every training example.
2. For each example where the metric score clears a threshold, record
   the full trace (intermediate CoT + final prediction).
3. Sample up to `max_bootstrapped_demos` of those traces as few-shot
   exemplars baked into the compiled module.
4. Score the compiled module and keep it if it beats the baseline.

Because traces come from the *same* LM we deploy with, the chosen
exemplars encode the model's own best-known solution path — no human
prompt tuning required.

## How to run locally

```bash
cd services/rag
pip install -r requirements.txt    # installs dspy-ai>=2.5.0

# Option A: OpenAI
export OPENAI_API_KEY=sk-...
python -m app.optimization.optimize

# Option B: Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
python -m app.optimization.optimize --model anthropic/claude-3-5-haiku-latest

# Custom paths
python -m app.optimization.optimize \
  --golden evals/golden_set.yaml \
  --out app/optimization/optimized
```

The CLI prints a before/after table::

    == classify_query ==
      baseline: 0.612
      compiled: 0.738  (+0.126)
    == plan_retrieval ==
      baseline: 0.554
      compiled: 0.671  (+0.117)
    == generate_answer ==
      baseline: 0.701
      compiled: 0.812  (+0.111)

Exit code is non-zero if any module regresses, so this plugs directly
into CI as a quality gate.

## How to deploy optimized prompts

The compiled JSON files in `app/optimization/optimized/` are commit-safe
(deterministic text artifacts). Deployment is just:

1. Run `python -m app.optimization.optimize` in CI on the nightly
   schedule that already runs RAGAS.
2. Open a PR with the updated JSON files under
   `app/optimization/optimized/`.
3. At request time, the RAG orchestrator calls
   `Module.load("app/optimization/optimized/generate_answer.json")`
   before the first `forward()` — the loaded module becomes a drop-in
   replacement for the current hand-crafted prompt.

Rollback is a `git revert` of the JSON file — no code change, no
redeploy of the service container.

## Expected improvement

Target: **+10% faithfulness** on the RAGAS golden set vs. the current
hand-written prompts, measured by `combined_metric` in `metrics.py`
(average of faithfulness + answer_relevancy).

Stanford's DSPy paper reports 25-65% gains on comparable RAG tasks
with BootstrapFewShot; 10% is a conservative internal floor that
accounts for the small golden set and strong baseline prompts.

## When to re-optimize

Re-run `python -m app.optimization.optimize` whenever any of the
following changes:

- **Golden set changes** — new entries added to
  `services/rag/evals/golden_set.yaml` (most common trigger).
- **LM swap** — upgrading to a new model family (gpt-4o → gpt-4.1,
  claude-3.5 → claude-4). Compiled demos are LM-specific.
- **Signature changes** — adding/renaming input or output fields.
- **Monthly cadence** — scheduled re-run to catch drift even if none
  of the above triggered.
- **Faithfulness regression** — if the nightly RAGAS job drops more
  than 3% on any bucket, fire an optimization run before investigating
  further.

Keep an eye on the `optimized/*.json` diff: large swings in which
exemplars were chosen usually indicate a real distribution shift in
the golden set and deserve a human review before merge.
