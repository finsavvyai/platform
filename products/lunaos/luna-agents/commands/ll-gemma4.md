# Gemma 4 Local AI Setup

Set up Google Gemma 4 for free, local AI inference via Ollama. Zero cost, 256K context, multimodal (text+image+audio).

## Model Variants

| Model | Active Params | Context | Modalities | Best For |
|-------|--------------|---------|------------|----------|
| `gemma4:31b` | 30.7B | 256K | Text, Image | Best quality, fine-tuning |
| `gemma4:26b` | 3.8B (MoE) | 256K | Text, Image | Fastest, low latency |
| `gemma4:e4b` | 4.5B | 128K | Text, Image, Audio | Edge + voice |
| `gemma4:e2b` | 2.3B | 128K | Text, Image, Audio | Mobile, IoT |

## Quick Setup

```bash
# Install Ollama (if not installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull Gemma 4 (choose one)
ollama pull gemma4          # Default (31B, ~18GB)
ollama pull gemma4:26b      # MoE, fastest (~15GB)
ollama pull gemma4:e4b      # Edge with audio (~5GB)
ollama pull gemma4:e2b      # Smallest (~3GB)

# Verify
ollama run gemma4 "Hello, are you Gemma 4?"
```

## Integration

Gemma 4 is auto-detected by:
- **AMLiQ**: `ModelRouter` checks Ollama → routes screening LLM calls for free
- **LunaOS**: `smart-router.ts` uses gemma4 for free-tier users
- **Local providers**: `checkOllamaGemma4()` in local-providers.ts

### Environment Variables

```bash
OLLAMA_HOST=http://localhost:11434   # Default Ollama endpoint
GEMMA_MODEL=gemma4                   # Model tag (gemma4, gemma4:26b, etc.)
```

### AMLiQ Cost Savings

| Provider | Cost per 1K screenings | Latency |
|----------|----------------------|---------|
| Anthropic Claude | ~$3.00 | ~500ms |
| Claw Gateway | ~$1.00 | ~300ms |
| **Gemma 4 local** | **$0.00** | **~50ms** |

## Benchmarks vs Competitors

| Benchmark | Gemma 4 31B | Qwen 3.5 27B | Llama 4 Scout |
|-----------|-------------|-------------|---------------|
| AIME 2026 (math) | **89.2%** | 48.7% | — |
| LiveCodeBench | **80.0%** | — | — |
| MMMU Pro (vision) | **76.9%** | — | — |
| Arena AI | **#3 open** | — | — |

## Architecture Highlights

- **Hybrid Attention**: sliding window (1024) + global attention
- **Per-Layer Embeddings**: residual signal into every decoder layer
- **Shared KV Cache**: last N layers reuse earlier KV states (less VRAM)
- **262K vocabulary**: massive token coverage across 140+ languages
- **Apache-like license**: permissive for commercial use

## Hardware Requirements

| Model | VRAM (Q4) | RAM | Disk |
|-------|-----------|-----|------|
| 31B | ~18GB | 24GB+ | 18GB |
| 26B MoE | ~15GB | 20GB+ | 15GB |
| E4B | ~5GB | 8GB+ | 5GB |
| E2B | ~3GB | 4GB+ | 3GB |

## What This Command Does

1. Checks if Ollama is installed
2. Pulls the appropriate Gemma 4 model based on available VRAM
3. Verifies the model loads and responds
4. Tests integration with the current project (AMLiQ screening or LunaOS routing)
5. Reports cost savings estimate
