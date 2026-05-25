# /r/Python Post

## Title

ClawPipe: One-line OpenAI replacement that cuts LLM costs 30-50% — Python SDK now available

## Body

We built an LLM cost optimization SDK. The Python SDK just shipped. Here's the pitch: change one import, save 30-50% on your LLM bill.

**The one-line change:**

```python
# Before
from openai import OpenAI
client = OpenAI()

# After
from clawpipe import ClawPipe
client = ClawPipe(api_key="cp_xxx", project_id="my-app")
```

Same interface. Same response shape. Your existing `client.chat.completions.create()` calls work unchanged.

**What it does under the hood:**

ClawPipe runs a six-stage pipeline on every request:

1. **Booster** — Detects deterministic tasks (math, dates, conversions, JSON formatting) and resolves them in <1ms without calling any LLM. Catches ~30% of typical traffic.

2. **Packer** — Compresses your prompt context. Removes redundant tokens from system prompts, conversation history, and RAG context. Saves 20-60% on token count.

3. **Semantic Cache** — If someone asked a semantically similar question before, returns the cached answer. "Explain recursion" and "What is recursion?" hit the same cache entry. 15-35% hit rate.

4. **Router** — Self-learning model selector. Learns from your traffic which model gives the best cost/quality tradeoff per task type. Routes simple tasks to cheap models, keeps complex tasks on GPT-4.

5. **Gateway** — Calls OpenAI, Anthropic, DeepSeek, Groq, Mistral directly.

6. **Learner** — Tracks outcomes, improves routing over time.

**Python-specific features:**

```python
from clawpipe import ClawPipe

pipe = ClawPipe(
    api_key="cp_xxx",
    project_id="my-app",
    enable_booster=True,
    enable_packer=True,
    enable_cache=True,
    enable_trace=True,  # See what each stage does
)

# Standard prompt
result = pipe.prompt("What is 15% of $240?")
print(result.text)       # "$36.00"
print(result.meta)       # {"boosted": True, "latency_ms": 0.1, "cost_usd": 0.0}

# Streaming
for chunk in pipe.stream("Summarize this document", system="..."):
    print(chunk, end="")

# Stats
print(pipe.stats())      # Requests, cost, cache rate, top models
print(pipe.budget_status())  # Spend tracking
```

**Install:**

```bash
pip install clawpipe-ai
```

**Type hints:** Full type annotations throughout. Works with mypy and pyright.

**Async support:**

```python
import asyncio
from clawpipe import AsyncClawPipe

async def main():
    pipe = AsyncClawPipe(api_key="cp_xxx", project_id="my-app")
    result = await pipe.prompt("Explain this code")
    print(result.text)

asyncio.run(main())
```

**Benchmarks on our production traffic (50K calls/day):**

- 43% cost reduction ($12K/mo -> $6.8K/mo)
- 27% latency reduction (p50: 850ms -> 620ms)
- 30% of calls resolved by Booster at $0
- 18% cache hit rate in week 1, growing to 35% by week 4

**No vendor lock-in.** Removing ClawPipe = reverting one import. Your prompts and provider keys are yours.

**Pricing:** Free tier (1K calls/day), Pro ($49/mo, 100K/day). MIT licensed.

Links:
- PyPI: `pip install clawpipe-ai`
- npm (TypeScript): `npm install clawpipe-ai`
- Website: [clawpipe.ai](https://clawpipe.ai)
- Docs: [docs.clawpipe.ai](https://docs.clawpipe.ai)

Happy to answer questions about the Python SDK, architecture, or benchmarks.
