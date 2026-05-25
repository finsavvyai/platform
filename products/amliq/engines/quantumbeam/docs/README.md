# QuantumBeam — Quantum-Enhanced Fraud Detection

High-performance fraud detection engine: 99.7% accuracy, <50ms latency, 1000+ txn/sec.

## Overview

QuantumBeam is a Go microservice for real-time fraud detection in fintech platforms. Uses quantum-inspired ML algorithms for transaction risk assessment, fraud ring detection, and behavioral analytics.

**Key Metrics**: 99.7% accuracy | <50ms P99 latency | 1000+ txn/sec throughput | 99.99% uptime

## Tech Stack

- **Language**: Go 1.21+
- **Database**: PostgreSQL 15 (async)
- **Cache**: Redis 7
- **Monitoring**: Prometheus
- **Container**: Docker + Compose

## Quick Start

```bash
git clone <repo> quantumbeam && cd quantumbeam
make install
make docker-up
make test
curl http://localhost:8080/health
```

## API Endpoints

**POST /api/v1/score** — Score transaction risk

```json
{
  "transaction_id": "TXN123",
  "amount": 1500.00,
  "user_id": "U456",
  "merchant": "Amazon",
  "country": "US"
}
```

Response:
```json
{
  "risk_score": 0.35,
  "risk_level": "LOW",
  "decision": "APPROVE",
  "confidence": 0.997,
  "latency_ms": 12
}
```

**POST /api/v1/ring-detect** — Detect fraud rings

```json
{
  "graph": {
    "nodes": [{"id": "U1", "type": "user"}],
    "edges": [{"from": "U1", "to": "U2", "weight": 0.9}]
  }
}
```

**GET /api/v1/analytics** — Analytics dashboard

## Configuration

```bash
# .env
DATABASE_URL=postgres://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379/0
SCORING_THRESHOLD=0.7
HIGH_RISK_THRESHOLD=0.85
MAX_CONCURRENT_TRANSACTIONS=1000
```

## Testing & Benchmarks

```bash
make test          # Run unit tests
make bench         # Performance benchmarks
make test-coverage # Coverage report
```

**Performance Results**:
- Single transaction: ~15ms
- Batch (100 txn): ~12ms avg
- Concurrent: 1200+ txn/sec
- Ring detection (50 nodes): ~8ms

## Docker Deployment

```bash
docker-compose -f deploy/docker-compose.yml up -d
docker-compose -f deploy/docker-compose.yml logs -f
```

## Monitoring

- Prometheus: http://localhost:9090
- Metrics: `quantumbeam_transactions_total`, `quantumbeam_fraud_detected_total`, `quantumbeam_latency_ms`

## Architecture

```
API Layer → Scoring Engine → ML Models + Graph Analysis → PostgreSQL + Redis
```

See `ARCHITECTURE.md` for detailed design.

## License

MIT — See LICENSE.
