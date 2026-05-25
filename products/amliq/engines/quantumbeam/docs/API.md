# QuantumBeam API Reference

## Base URL & Auth

`https://api.quantumbeam.io/api/v1`

All requests: `Authorization: Bearer qb_xxx`

## POST /score

Score transaction risk. Request:
```json
{"transaction_id": "TXN123", "amount": 1500.00, "user_id": "U789", "merchant": "Amazon", "country": "US"}
```
Response: `{"risk_score": 0.35, "risk_level": "LOW", "decision": "APPROVE", "confidence": 0.997, "latency_ms": 12}`

**Risk Levels**: LOW (0.0–0.5) | MEDIUM (0.5–0.8) | HIGH (0.8–1.0)

## POST /ring-detect

Detect fraud rings. Request:
```json
{"graph": {"nodes": [{"id": "U1", "type": "user"}], "edges": [{"from": "U1", "to": "U2", "weight": 0.95}]}}
```
Response: `{"rings": [{"members": 3, "risk": 0.89, "pattern": "money_cycling"}], "total_rings": 1}`

## GET /analytics

Analytics dashboard.

Query: `?start=2026-03-20T00:00:00Z&end=2026-03-21T00:00:00Z&granularity=hour`

Response: `{"summary": {"total_transactions": 125432, "fraud_detected": 89, "accuracy": 0.997, "avg_latency_ms": 23}}`

## POST /batch-score

Batch transaction scoring. Request:
```json
{"transactions": [{"transaction_id": "TXN1", "amount": 100.0}]}
```
Response: `{"results": [{"transaction_id": "TXN1", "risk_score": 0.2}], "processing_time_ms": 45}`

## GET /health

Service status. Response: `{"status": "healthy", "version": "1.2.0", "database": "connected"}`

## Error Responses

- **400**: `{"error": "invalid_request", "message": "..."}`
- **401**: `{"error": "invalid_token"}`
- **429**: `{"error": "rate_limited", "retry_after": 60}`
- **500**: `{"error": "internal_error"}`

## Rate Limits

- Free: 1,000 req/day, 10 req/sec
- Pro: 100,000 req/day, 100 req/sec
- Enterprise: Custom

## Webhooks

```bash
POST /webhooks
{"url": "https://yourapp.com/fraud-alert", "events": ["high_risk_transaction", "ring_detected"]}
```

## SDKs

- JavaScript: `npm install quantumbeam`
- Python: `pip install quantumbeam`
- Go: `go get github.com/quantumbeam/sdk-go`
