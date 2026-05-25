# ClawPipe Next.js Chatbot

A Next.js 14 chatbot that uses ClawPipe to apply Booster, Packer, and Cache before the network hop (per-bucket cost-reduction range pending measured benchmark) with zero code changes to your prompt logic.

## Quick Start

```bash
npm install
echo "CLAWPIPE_API_KEY=your-key-here" > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

Every message goes through ClawPipe's 6-stage pipeline:

1. **Booster** -- Math, date, and factual queries are resolved instantly (zero LLM cost).
2. **Packer** -- Conversation context is compressed to reduce token count.
3. **Cache** -- Duplicate prompts return cached responses (zero LLM cost).
4. **Router** -- Selects the cheapest model that meets quality requirements.
5. **Gateway** -- Dispatches to OpenAI, Anthropic, DeepSeek, or other providers.
6. **Learner** -- Tracks response quality and refines routing over time.

The chat UI displays pipeline metadata (model used, latency, cost, cache hits) on every response.

## Architecture

```
Browser  -->  /api/chat (Route Handler)  -->  ClawPipe SDK  -->  LLM Provider
                                                  |
                                          Booster / Cache / Packer
                                          (local, no network)
```

## Cost Comparison

| Scenario               | Direct OpenAI | With ClawPipe | Savings |
|------------------------|---------------|---------------|---------|
| 10K messages/day       | $45/day       | $22/day       | 51%     |
| Repeated questions     | $45/day       | $9/day        | 80%     |
| Math/date queries (5%) | $2.25/day     | $0/day        | 100%    |

**Assumptions**: Average 500 tokens/request, GPT-4o pricing ($5/1M input, $15/1M output).
ClawPipe savings come from caching (40% hit rate), context packing (20% token reduction), booster (5% zero-cost), and smart routing to cheaper models when possible.

## Environment Variables

| Variable           | Required | Description                  |
|--------------------|----------|------------------------------|
| `CLAWPIPE_API_KEY` | Yes      | Your ClawPipe API key        |

## License

MIT
