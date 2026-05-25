# clawpipe-langchain

LangChain integration for [ClawPipe](https://clawpipe.ai) — the intelligent LLM cost optimization pipeline.

ClawPipe sits between your app and LLM providers, applying boosting, context packing, prompt caching, and smart routing on every call. Per-bucket cost-reduction range pending public measured benchmark at github.com/finsavvyai/clawpipe-booster-benchmark. Pipeline mechanics:  automatic boosting, context packing, prompt caching, and smart routing.

## Installation

```bash
pip install clawpipe-langchain
```

## Quick Start

### Chat Model (recommended)

```python
from clawpipe_langchain import ClawPipeChatModel
from langchain_core.messages import HumanMessage

llm = ClawPipeChatModel(api_key="cp_xxx", project_id="my-app")
response = llm.invoke([HumanMessage(content="Explain recursion")])
# Routed through ClawPipe pipeline — optimized automatically
```

### Completion LLM

```python
from clawpipe_langchain import ClawPipeLLM

llm = ClawPipeLLM(api_key="cp_xxx", project_id="my-app")
result = llm.invoke("Explain recursion in one sentence")
```

### With LangChain Chains

```python
from clawpipe_langchain import ClawPipeChatModel
from langchain_core.prompts import ChatPromptTemplate

llm = ClawPipeChatModel(api_key="cp_xxx", project_id="my-app")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("human", "{input}"),
])
chain = prompt | llm
response = chain.invoke({"input": "What is LangChain?"})
```

## Configuration

| Parameter        | Type   | Default                       | Description                          |
|-----------------|--------|-------------------------------|--------------------------------------|
| `api_key`       | str    | required                      | Your ClawPipe API key                |
| `project_id`    | str    | required                      | Your ClawPipe project ID             |
| `gateway_url`   | str    | `https://api.clawpipe.ai`    | Gateway endpoint                     |
| `provider`      | str    | None (auto-routed)            | Force a specific provider            |
| `model`         | str    | None (auto-routed)            | Force a specific model               |
| `max_tokens`    | int    | None                          | Maximum output tokens                |
| `temperature`   | float  | None                          | Sampling temperature                 |
| `enable_booster`| bool   | True                          | Enable deterministic transform layer |
| `enable_cache`  | bool   | True                          | Enable prompt deduplication cache    |

## How It Works

When you call the LLM, your request flows through the ClawPipe pipeline:

1. **Booster** — deterministic transforms that skip LLM calls entirely
2. **Packer** — compress context to reduce token count
3. **Cache** — hash-based prompt deduplication
4. **Router** — cost/quality/latency-aware model selection
5. **Provider Call** — dispatched to the optimal LLM provider
6. **Learner** — tracks outcomes to refine future routing

## License

MIT
