---
name: ll-local-llm
displayName: Luna Local LLM
description: Run AI agents locally using llamafile — zero cost, fully offline, OpenAI-compatible API
version: 1.0.0
category: infrastructure
agent: luna-task-executor
parameters:
  - name: action
    type: string
    description: "Action: start (launch llamafile server), stop (shut down), status (check running)"
    required: true
    prompt: true
  - name: model
    type: string
    description: "Model to run (default: qwen3.5-0.8b)"
    required: false
    default: qwen3.5-0.8b
mcp_servers:
  - memory
  - git
prerequisites:
  - name: llamafile
    check: "which llamafile || ls ~/.local/bin/llamafile"
    install: "curl -fLo llamafile https://github.com/mozilla-ai/llamafile/releases/latest/download/llamafile && chmod +x llamafile && mv llamafile ~/.local/bin/"
    optional: false
---

# /local-llm — Zero-Cost Local AI with llamafile

Run AI agents entirely offline using llamafile. Downloads and runs a single binary that exposes an OpenAI-compatible API at `localhost:8080`. Use Luna CLI's `--local` flag to route all agent calls through llamafile instead of Claw Gateway.

## What It Does

```
/local-llm start
    │
    ├── CHECK: llamafile binary available?
    │   ├── YES → Continue
    │   └── NO  → Download from GitHub releases
    │
    ├── DOWNLOAD MODEL (if not cached)
    │   ├── qwen3.5-0.8b (default, 800 MB, fast)
    │   ├── llama-3.1-8b (8 GB, balanced)
    │   ├── mistral-7b (7 GB, general purpose)
    │   └── codellama-13b (13 GB, code-focused)
    │
    ├── START SERVER
    │   ├── Launch llamafile on localhost:8080
    │   ├── OpenAI-compatible /v1/chat/completions
    │   ├── GPU auto-detection (Metal, CUDA, Vulkan)
    │   └── Print status + connection URL
    │
    └── CONFIGURE LUNA
        ├── Set LUNA_LOCAL=true
        ├── Route --local flag to localhost:8080
        └── All agents use local model
```

## How It Works

1. **Single binary**: llamafile bundles model + runtime into one executable
2. **OpenAI-compatible**: Drop-in replacement for OpenAI API at localhost:8080
3. **GPU acceleration**: Auto-detects Metal (macOS), CUDA (Linux), Vulkan
4. **Luna integration**: `--local` flag on any Luna command routes through llamafile
5. **Model caching**: Downloaded models are cached in `~/.llamafile/models/`

## Available Models

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| qwen3.5-0.8b | 800 MB | Very fast | Quick tasks, offline dev |
| **gemma4:e2b** | **3 GB** | **Very fast** | **Edge, audio+vision, 128K ctx** |
| **gemma4:e4b** | **5 GB** | **Fast** | **Edge, audio+vision, 128K ctx** |
| mistral-7b | 7 GB | Fast | General purpose |
| llama-3.1-8b | 8 GB | Medium | Balanced quality |
| codellama-13b | 13 GB | Slower | Code generation |
| **gemma4:26b** | **15 GB** | **Fast (MoE)** | **Best open-source, 256K ctx, 3.8B active** |
| **gemma4:31b** | **18 GB** | **Medium** | **Highest quality open model, 256K ctx** |

## Usage

```bash
/local-llm start                                 # Start with default model
/local-llm start --model llama-3.1-8b            # Start with specific model
/local-llm status                                # Check if running
/local-llm stop                                  # Shut down server
```

## Luna CLI Integration

```bash
luna run --local "Write unit tests for auth"     # Uses llamafile
luna chain --local plan >> go >> test             # Full pipeline offline
luna agent --local "Refactor this module"         # Agent uses local LLM
```

## Use Cases

| Use Case | Why |
|----------|-----|
| Offline development | No internet required |
| Free tier | Zero API costs |
| Air-gapped environments | Security-sensitive work |
| Privacy | Code never leaves your machine |
| CI runners | No API key management |

## Output Structure

```
~/.llamafile/
├── bin/llamafile           # Binary
├── models/                 # Cached model files
│   ├── qwen3.5-0.8b.gguf
│   └── llama-3.1-8b.gguf
└── logs/                   # Server logs
    └── llamafile.log
```

## In Pipes

```bash
/pipe local-llm start >> go *5 >> test >> local-llm stop     # Offline sprint
/pipe local-llm start >> swarm "build feature" --agents 3    # Local swarm
/pipe local-llm status >> if $running >> go >> else >> local-llm start >> go
```

## Reference

- llamafile: https://github.com/mozilla-ai/llamafile
- Models: https://huggingface.co/models?library=gguf
