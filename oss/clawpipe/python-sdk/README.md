# ClawPipe Python SDK

The intelligent AI pipeline. Cut LLM costs 30-50% without changing your application logic.

## Install

```bash
pip install clawpipe-ai
```

## Quick Start

```python
from clawpipe import ClawPipe, ClawPipeConfig

pipe = ClawPipe(ClawPipeConfig(
    api_key="your-api-key",
    project_id="your-project-id",
))

# Async usage
result = await pipe.prompt("Explain quantum computing in one sentence")
print(result.text)
print(result.meta)  # latency, cost, cache hit, etc.

# Sync usage
result = pipe.prompt_sync("calculate 2 + 2")
print(result.text)  # "4" (resolved locally by Booster, zero cost)

# Telemetry
stats = pipe.stats()
print(stats.total_cost_usd, stats.cache_hit_rate)
```

## Pipeline Stages

1. **Booster** -- deterministic transforms (math, dates, JSON, UUID, base64, unit conversion)
2. **Packer** -- compress context to reduce token count
3. **Cache** -- hash-based prompt deduplication with TTL
4. **Router** -- self-learning cost/quality/latency model selection
5. **Gateway** -- multi-provider dispatch (OpenAI, Anthropic, DeepSeek, Groq, Mistral)
6. **Telemetry** -- cost tracking and usage analytics

## Development

```bash
pip install -e ".[dev]"
pytest tests/ -v
```

## License

MIT
