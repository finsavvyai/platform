<div align="center">

# FinSavvyAI

**Enterprise-grade distributed AI cluster management with OpenAI-compatible API**

[![CI](https://img.shields.io/github/actions/workflow/status/finsavvyai/finsavvyai/ci.yml?label=CI&logo=github)](https://github.com/finsavvyai/finsavvyai/actions)
[![Coverage](https://img.shields.io/badge/Coverage-97%25-brightgreen)](https://github.com/finsavvyai/finsavvyai)
[![PyPI](https://img.shields.io/pypi/v/finsavvyai?logo=pypi&logoColor=white)](https://pypi.org/project/finsavvyai/)
[![Docker](https://img.shields.io/docker/pulls/finsavvyai/finsavvyai?logo=docker)](https://hub.docker.com/r/finsavvyai/finsavvyai)
[![License MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)](LICENSE)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-Compatible-412991?logo=openai&logoColor=white)](docs/OPENAI_COMPAT.md)

[Live Demo](https://demo.finsavvyai.com) ·
[Docs](docs/) ·
[Quickstart](#quick-install) ·
[Discord](https://discord.gg/finsavvyai) ·
[Report Bug](https://github.com/finsavvyai/finsavvyai/issues)

</div>

---

## Quick Install

### Docker (fastest)

```bash
docker run -p 8080:8080 -e OPENAI_API_KEY=sk-... finsavvyai/finsavvyai:latest
```

### pip

```bash
pip install finsavvyai
finsavvyai quickstart   # interactive setup wizard
finsavvyai doctor       # verify everything is healthy
```

### Homebrew

```bash
brew install finsavvyai/tap/finsavvyai
finsavvyai quickstart
```

**Verify in 30 seconds:**

```bash
curl http://localhost:8080/health?verbose=true
```

---

## Try It Now

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

Or use the OpenAI Python SDK — just change `base_url`:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8080/v1", api_key="any")
response = client.chat.completions.create(
    model="gpt-4o",  # or llama3.2, claude-3-5-sonnet, lmstudio/...
    messages=[{"role": "user", "content": "Hello!"}],
)
```

---

## Feature Highlights

| Feature | Description |
|---------|-------------|
| **Multi-Provider Routing** | OpenAI, Anthropic, Ollama, LM Studio, OpenHands — one unified API |
| **Agent Governance** | Policy engine + live safety scoring on every agentic request |
| **OpenAI-Compatible API** | Drop-in `/v1/chat/completions` with streaming, embeddings, and arena |
| **Multi-Platform** | CLI, Desktop (Go), iOS (Swift), Web Dashboard, Control Hub (Node.js) |
| **Clustering** | Master-worker architecture with mDNS auto-discovery and load balancing |
| **Observability** | Prometheus metrics, Grafana dashboards, AlertManager, distributed tracing |

---

## Architecture

```text
Clients (OpenAI SDK / curl / LangChain)
         |
         v
 +------------------+
 |   API Gateway    | :8080  <- your base_url
 |  Auth + Rate Limit
 |  Circuit Breaker |
 +--------+---------+
          |  Intelligent Router
    +-----+------+------------+
    v            v            v
+--------+  +--------+  +--------------+
|Worker 1|  |Worker N|  |Cloud Provider|
|(Ollama)|  |(vLLM)  |  |OpenAI/Claude |
+----+---+  +----+---+  +--------------+
     +------+----+
            v
   +-----------------+
   |  Master Server  | :8000  cluster coordinator
   |  Node registry  |
   |  Health tracking|
   +-----------------+
```

---

## Works With

Route through FinSavvyAI without changing application code:

**OpenAI SDK** · **LangChain** · **LlamaIndex** · **AutoGen** · **CrewAI** · **Continue.dev** · **Cursor**

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | Chat completions (streaming supported) |
| `GET`  | `/v1/models` | List available models |
| `POST` | `/v1/embeddings` | Text embeddings |
| `GET`  | `/v1/compat` | OpenAI compatibility matrix |
| `POST` | `/agent/decision` | Agent governance routing |
| `GET`  | `/health?verbose=true` | Health + setup completion % |
| `GET`  | `/metrics` | Prometheus metrics |
| `GET`  | `/docs` | Interactive API playground |

See [docs/OPENAI_COMPAT.md](docs/OPENAI_COMPAT.md) for full compatibility details.

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Clustering](docs/CLUSTER_MANAGER_GUIDE.md) | Multi-node cluster setup and management |
| [LM Studio Integration](docs/LM_STUDIO_INTEGRATION.md) | Connect local LM Studio models |
| [Production Deployment](docs/PRODUCTION_DEPLOYMENT.md) | Docker, Helm, and systemd guides |
| [Testing Guide](docs/TESTING_GUIDE.md) | Running and writing tests |
| [OpenAI Compatibility](docs/OPENAI_COMPAT.md) | SDK compatibility matrix |

---

## Configuration

Copy `.env.example` to `.env`. Every variable is documented inline.

```bash
OPENAI_API_KEY=sk-...           # Cloud provider (optional)
ANTHROPIC_API_KEY=sk-ant-...    # Cloud provider (optional)
OLLAMA_BASE_URL=http://localhost:11434  # Local models
LMSTUDIO_BASE_URL=http://localhost:1234 # LM Studio models
FINSAVVYAI_AUTH_ENABLED=false   # Set true in production
```

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

- [Bug Reports](https://github.com/finsavvyai/finsavvyai/issues/new?template=bug_report.md)
- [Feature Requests](https://github.com/finsavvyai/finsavvyai/issues/new?template=feature_request.md)
- [Discussions](https://github.com/finsavvyai/finsavvyai/discussions)

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

---

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**[Star on GitHub](https://github.com/finsavvyai/finsavvyai) · [Join Discord](https://discord.gg/finsavvyai) · [Follow on X](https://x.com/finsavvyai)**

</div>
