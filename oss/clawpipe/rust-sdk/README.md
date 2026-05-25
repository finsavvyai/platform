# ClawPipe Rust SDK

The intelligent AI pipeline. Cut LLM costs 30-50%.

## Installation

```toml
[dependencies]
clawpipe-ai = "3.0.0"
```

## Quick Start

```rust
use clawpipe_ai::ClawPipe;

#[tokio::main]
async fn main() {
    let pipe = ClawPipe::new("cp_xxx", "my-app");
    let result = pipe.prompt("Calculate 42 * 2", None).await.unwrap();
    println!("{}", result.text);       // "84"
    println!("{}", result.meta.boosted); // true
}
```

## Pipeline Stages

```
Request -> Booster -> Packer -> Cache -> Router -> Gateway -> Learn
```

1. **Booster** -- deterministic transforms that skip LLM calls (math, JSON, dates, units, UUID, base64)
2. **Packer** -- compress context to reduce token count
3. **Cache** -- hash-based prompt deduplication with TTL + LRU
4. **Router** -- cost/quality/latency-aware model selection (8 models)
5. **Gateway** -- multi-provider dispatch (OpenAI, Anthropic, DeepSeek, Groq, Mistral)
6. **Learner** -- track outcomes and refine routing weights

## Configuration

```rust
use clawpipe_ai::{ClawPipe, types::ClawPipeConfig};

let pipe = ClawPipe::with_config(ClawPipeConfig {
    api_key: "cp_xxx".to_string(),
    project_id: "my-app".to_string(),
    gateway_url: Some("https://api.clawpipe.ai/v1".to_string()),
    cache_ttl_ms: Some(300_000),
    enable_booster: Some(true),
    enable_packer: Some(true),
    enable_cache: Some(true),
    budget_cap_usd: None,
});
```

## License

MIT
