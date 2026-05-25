# /r/LocalLLaMA Post

## Title

ClawPipe: SDK with automatic local model fallback — detects Ollama, llamafile, and LM Studio, routes to them when appropriate

## Body

Built an SDK that auto-detects and routes to local models when they're available and appropriate for the task.

**The local model angle:**

ClawPipe has a `LocalProvider` that scans for running local inference servers:

```typescript
import { LocalProvider } from 'clawpipe-ai';

const local = new LocalProvider();
const models = await local.detect();
// [
//   { provider: 'local-llamafile', model: 'LLaMA_CPP', url: 'http://localhost:8080' },
//   { provider: 'local-ollama', model: 'llama3.1:70b', url: 'http://localhost:11434' },
//   { provider: 'local-lmstudio', model: 'mistral-7b', url: 'http://localhost:1234' }
// ]
```

It checks the standard ports for Ollama (11434), llamafile (8080), and LM Studio (1234). If any are running, they're added to the Router's model pool.

**How routing works with local models:**

The self-learning Router treats local models like any other provider. It scores them on cost ($0), latency (depends on your hardware), and quality (learned from your traffic). If you're running a decent local model, the Router will learn which tasks it handles well and route those tasks locally.

In practice, with a Llama 3.1 70B on a 4090:
- Simple Q&A and classification tasks get routed locally
- Complex reasoning and long-form generation stay on cloud models
- Cost drops further because local calls are $0

**Offline fallback:**

```typescript
const pipe = new ClawPipe({
  apiKey: 'cp_xxx',
  enableLocalFallback: true,
  localModelUrl: 'http://localhost:8080',
});
```

If cloud providers are unreachable (network issues, rate limits, outages), ClawPipe falls back to your local model. Combined with the Booster (which resolves deterministic tasks without any model), you can maintain service for a significant chunk of requests even fully offline.

**Offline capability breakdown:**
- Booster: 100% offline (deterministic computation, no model needed)
- Cache: 100% offline (local lookup)
- Local model: 100% offline (your hardware)
- Router: Works offline with cached weights

**The full pipeline (not just local routing):**

ClawPipe also does:
1. **Booster** — Resolves 30% of typical requests without any model (math, dates, JSON, conversions). $0 cost, <1ms.
2. **Packer** — Compresses context by 20-60%. Saves tokens whether you're using local or cloud models.
3. **Semantic Cache** — Deduplicates 15-35% of requests.
4. **Router** — Self-learning, routes to cheapest viable model (including local ones).
5. **Gateway** — OpenAI, Anthropic, DeepSeek, Groq, Mistral, plus your local models.

All local stages run in-process. No proxy server. No extra network hop.

**What I'd like feedback on:**
- What local inference servers should we add detection for beyond Ollama, llamafile, and LM Studio?
- Would a benchmark mode that tests your local model against cloud models for your specific task types be useful?
- Any interest in a hardware-aware Router that factors in GPU utilization when deciding local vs cloud?

**Links:**
- npm: `npm install clawpipe-ai`
- Website: [clawpipe.ai](https://clawpipe.ai)
- MIT licensed, free tier: 1,000 calls/day
