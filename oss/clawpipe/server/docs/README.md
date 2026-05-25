# FinSavvyAI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

Enterprise-grade distributed AI cluster management system with OpenAI-compatible API gateway. Multi-provider routing, intelligent governance, production-ready monitoring.

## Features

- **Multi-Provider Routing** — Route requests across OpenAI, Anthropic, Ollama, and LM Studio with intelligent fallback chains
- **Agent Governance** — Policy-driven control with rate limiting, cost tracking, and compliance enforcement
- **Master-Worker Clustering** — Distributed architecture with automatic mDNS discovery and horizontal scaling
- **Production Monitoring** — Prometheus metrics and Grafana dashboards for real-time observability
- **OpenAI-Compatible API** — Drop-in replacement for OpenAI API — use existing integrations without code changes
- **Multi-Language Support** — SDKs for Python, JavaScript, and Go

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+ (for local development)
- PostgreSQL 15+
- Redis 7+

### Installation

**Using Docker Compose (Recommended)**

```bash
git clone https://github.com/finsavvyai/finsavvyai.git
cd finsavvyai
cp deploy/.env.example deploy/.env
# Edit deploy/.env with your API keys
docker-compose -f deploy/docker-compose.prod.yml up -d
```

**Local Development**

```bash
git clone https://github.com/finsavvyai/finsavvyai.git
cd finsavvyai
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn src.finsavvyai.api.main:app --reload --port 8040
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Core settings
DATABASE_URL=postgresql://user:pass@localhost/finsavvyai
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your_secret_key_here

# Provider credentials
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Governance
RATE_LIMIT_PER_MINUTE=1000
MAX_CONCURRENT_REQUESTS=500
COST_LIMIT_USD_PER_DAY=10000
```

## Usage

### Making API Calls

```python
from openai import OpenAI

# Use FinSavvyAI as drop-in OpenAI replacement
client = OpenAI(
    api_key="your-finsavvyai-key",
    base_url="http://localhost:8040/v1"
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)
print(response.choices[0].message.content)
```

### cURL Example

```bash
curl -X POST http://localhost:8040/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## API Reference

See [API.md](./API.md) for complete endpoint documentation.

## Deployment

### Production Deployment

```bash
docker-compose -f deploy/docker-compose.prod.yml up -d
```

Services:
- **FastAPI** (port 8040) — Main API gateway
- **PostgreSQL** (port 5432) — Request logging & policies
- **Redis** (port 6379) — Caching & rate limiting
- **Prometheus** (port 9090) — Metrics collection
- **Grafana** (port 3000) — Dashboards

### Scaling

Add worker nodes to `deploy/.env`:

```bash
WORKER_NODES=worker-1,worker-2,worker-3
```

## Monitoring

Access monitoring dashboards:
- Grafana: http://localhost:3000 (default: admin/admin)
- Prometheus: http://localhost:9090

## Testing

```bash
pytest tests/ -v --cov=src/finsavvyai --cov-report=html
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT License — see [LICENSE](../LICENSE) file.

## Support

- Documentation: [docs/](.)
- Issues: [GitHub Issues](https://github.com/finsavvyai/finsavvyai/issues)
- Discussions: [GitHub Discussions](https://github.com/finsavvyai/finsavvyai/discussions)
