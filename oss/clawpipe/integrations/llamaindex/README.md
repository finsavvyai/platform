# clawpipe-llamaindex

LlamaIndex integration for [ClawPipe](https://clawpipe.ai) — the intelligent LLM cost optimization pipeline.

ClawPipe sits between your app and LLM providers, applying boosting, context packing, prompt caching, and smart routing on every call. Per-bucket cost-reduction range pending public measured benchmark at github.com/finsavvyai/clawpipe-booster-benchmark. Pipeline mechanics:  automatic boosting, context packing, prompt caching, and smart routing.

## Installation

```bash
pip install clawpipe-llamaindex
```

## Quick Start

### Completion

```python
from clawpipe_llamaindex import ClawPipeLLM

llm = ClawPipeLLM(api_key="cp_xxx")
response = llm.complete("Explain recursion")
print(response.text)
```

### Chat

```python
from clawpipe_llamaindex import ClawPipeLLM
from llama_index.core.base.llms.types import ChatMessage, MessageRole

llm = ClawPipeLLM(api_key="cp_xxx")
messages = [
    ChatMessage(role=MessageRole.SYSTEM, content="You are a helpful assistant."),
    ChatMessage(role=MessageRole.USER, content="Explain recursion"),
]
response = llm.chat(messages)
print(response.message.content)
```

### With LlamaIndex Query Engine

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings
from clawpipe_llamaindex import ClawPipeLLM

Settings.llm = ClawPipeLLM(api_key="cp_xxx")

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()
response = query_engine.query("What is in the documents?")
print(response)
```

## Configuration

| Parameter        | Type   | Default                    | Description                          |
|-----------------|--------|----------------------------|--------------------------------------|
| `api_key`       | str    | required                   | Your ClawPipe API key                |
| `gateway_url`   | str    | `https://api.clawpipe.ai` | Gateway endpoint                     |
| `provider`      | str    | None (auto-routed)         | Force a specific provider            |
| `model`         | str    | None (auto-routed)         | Force a specific model               |
| `max_tokens`    | int    | None                       | Maximum output tokens                |
| `temperature`   | float  | None                       | Sampling temperature                 |
| `enable_booster`| bool   | True                       | Enable deterministic transform layer |
| `enable_cache`  | bool   | True                       | Enable prompt deduplication cache    |
| `context_window`| int    | 8192                       | Context window size                  |
| `num_output`    | int    | 512                        | Max output tokens for metadata       |

## How It Works

When you call the LLM, your request flows through the ClawPipe pipeline:

1. **Booster** — deterministic transforms that skip LLM calls entirely
2. **Packer** — compress context to reduce token count
3. **Cache** — hash-based prompt deduplication
4. **Router** — cost/quality/latency-aware model selection
5. **Provider Call** — dispatched to the optimal LLM provider
6. **Learner** — tracks outcomes to refine future routing

## Roadmap

- Streaming (`stream_complete`, `stream_chat`) — coming soon
- Async variants (`acomplete`, `achat`) — coming soon

## License

MIT
