# Fraud Detection Service

Real-time fraud detection service with ML-powered anomaly detection.

**Migrated from:** QuantumBeam.io

## Features

- Real-time transaction fraud scoring
- ML-based anomaly detection (Isolation Forest, LSTM, Random Forest)
- Pattern recognition and behavioral analysis
- Risk scoring and alert management
- Integration with payment gateways

## Tech Stack

- Go microservices
- Python ML services
- Kubernetes deployment
- Prometheus monitoring

## Quick Start

```bash
# Build the service
make build

# Run locally
make run

# Run tests
make test

# Deploy to Kubernetes
kubectl apply -f configs/kubernetes/
```

## API Endpoints

- `POST /api/v1/fraud/analyze` - Analyze transaction for fraud
- `GET /api/v1/fraud/score/{id}` - Get fraud score
- `POST /api/v1/fraud/report` - Report fraud
- `GET /api/v1/fraud/alerts` - Get active alerts

## Documentation

See the [main platform README](../../README.md) for complete documentation.
