# @clawpipe/vercel-ai

Vercel AI SDK provider for [ClawPipe](https://clawpipe.ai) — the intelligent AI pipeline that applies boosting, context packing, prompt caching, and smart routing on every call (per-bucket cost-reduction range pending measured benchmark) without changing your application logic.

## Installation

```bash
npm install @clawpipe/vercel-ai ai clawpipe-ai
```

## Quick Start

```typescript
import { generateText, streamText } from 'ai';
import { createClawPipe } from '@clawpipe/vercel-ai';

const clawpipe = createClawPipe({ apiKey: 'cp_xxx' });

// Non-streaming — ClawPipe picks the best model automatically
const { text } = await generateText({
  model: clawpipe('auto'),
  prompt: 'Explain recursion',
});

// Streaming
const result = await streamText({
  model: clawpipe('auto'),
  prompt: 'Write a haiku about TypeScript',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Explicit Model Selection

Pass a specific model ID to bypass ClawPipe's smart routing:

```typescript
const { text } = await generateText({
  model: clawpipe('gpt-4o'),
  prompt: 'Explain quantum computing',
});
```

## Configuration

```typescript
const clawpipe = createClawPipe({
  apiKey: 'cp_xxx',           // Required: ClawPipe API key
  projectId: 'my-project',    // Optional: project for analytics
  gatewayUrl: 'https://...',  // Optional: custom gateway URL
  enableBooster: true,        // Optional: deterministic transforms (default: true)
  enablePacker: true,         // Optional: context compression (default: true)
  enableCache: true,          // Optional: prompt deduplication (default: true)
});
```

## How It Works

ClawPipe sits between your app and LLM providers. Every request passes through:

1. **Booster** — resolves deterministic prompts without an LLM call
2. **Packer** — compresses context to reduce token count
3. **Cache** — deduplicates identical prompts
4. **Router** — picks the best model for cost/quality/latency
5. **Gateway** — dispatches to OpenAI, Anthropic, DeepSeek, etc.

The Vercel AI SDK provider wraps this pipeline behind the standard `LanguageModelV1` interface, so `generateText` and `streamText` work out of the box.

## License

MIT
