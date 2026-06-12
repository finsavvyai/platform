# AMLIQ Fraud Engine (formerly QuantumBeam) - Classical ML Fraud Detection

<div align="center">

![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge)
![Latency](https://img.shields.io/badge/Latency%20Target-<50ms-brightgreen?style=for-the-badge)

**Classical machine-learning fraud scoring with a <50ms latency target** (accuracy not yet benchmarked)

[🚀 Quick Deploy](#-quick-deploy) • [📚 Documentation](#-documentation) • [✨ Features](#-features) • [🎯 Get Started](START_HERE.md)

</div>

---

## Status

The engine ships with:
- Classical ML fraud scoring (accuracy not yet benchmarked)
- <50ms processing-time target
- ✅ Circuit breaker & rate limiting
- ✅ Modern Qodo-inspired website
- ✅ Complete monitoring stack
- ✅ Security-hardened Docker images
- ✅ Comprehensive documentation

---

## 🚀 Quick Deploy

Deploy to production in 5 minutes:

```bash
# 1. Configure environment
cp .env.production.example .env.production
# Edit .env.production with your secrets

# 2. Deploy!
./QUICK_DEPLOY.sh

# 3. Verify
curl http://localhost:8080/health
```

**That's it!** Your fraud detection platform is now running. 🎉

---

## 📚 Documentation

**New user?** → Start here: [START_HERE.md](START_HERE.md)

Complete production documentation:

| Document | Purpose |
|----------|---------|
| [START_HERE.md](START_HERE.md) | 🎯 Navigation guide for new users |
| [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md) | 📊 Complete production status report |
| [DEPLOY_NOW.txt](DEPLOY_NOW.txt) | 🚀 Quick deployment instructions |
| [README_PRODUCTION.md](README_PRODUCTION.md) | 📖 Main production README |
| [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) | 📋 Complete deployment overview |
| [DEPLOY_TO_PRODUCTION.md](DEPLOY_TO_PRODUCTION.md) | 🌐 Platform-specific deployment guides |
| [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) | ✅ Production checklist |

---

## ✨ Features

### Scoring Algorithms (classical ML)
- **Random Forest / Gradient Boosting**: Primary transaction classifiers
- **Graph analysis**: Fraud ring detection
- **Anomaly detection**: Outlier scoring
- Note: the repo also contains experimental quantum-simulator prototype code (`services/quantum/`, local simulator only — no quantum hardware backend); it is not part of the production scoring path.

### Production Features
- **Circuit Breaker**: Prevents cascade failures
- **Rate Limiting**: 100 req/s with burst protection
- **Request Caching**: 5-minute TTL for performance
- **Health Monitoring**: Kubernetes-ready endpoints
- **Graceful Degradation**: Fallback scoring path on model-service failure
- **Metrics Collection**: Complete Prometheus integration

### Security
- **JWT Authentication**: Secure API access
- **Non-root Containers**: Enhanced security
- **API Key Encryption**: Protected credentials
- **TLS/SSL Ready**: Certificate configuration included
- **CORS Protection**: Whitelist-based access

---

## 🎨 Website

Modern marketing website with Qodo.ai-inspired design:
- Dark theme with purple/pink gradients
- Glassmorphism effects
- Framer Motion animations
- Quantum visualizations
- SEO optimized
- 30-second build time

Deploy website:
```bash
cd web/marketing
npm run build
vercel --prod
```

---

## 📊 Performance

| Metric | Target | Status |
|--------|--------|--------|
| Detection Accuracy | TBD | Not yet benchmarked |
| Processing Latency (p95) | <100ms | Target: 50ms (unverified) |
| Throughput | 10K req/s | Target (unverified) |
| False Positive Rate | <1% | Not yet benchmarked |

---

## 🌐 Deployment Options

Deploy to any platform:

| Platform | Command | Time |
|----------|---------|------|
| **Local** | `./QUICK_DEPLOY.sh` | 5 min |
| **Railway** | `railway up` | 3 min |
| **Fly.io** | `fly launch && fly deploy` | 5 min |
| **Kubernetes** | `kubectl apply -f k8s/production/` | 10 min |
| **Vercel** (website) | `cd web/marketing && vercel --prod` | 2 min |

See [DEPLOY_TO_PRODUCTION.md](DEPLOY_TO_PRODUCTION.md) for detailed platform guides.

---

## 🔧 API Example

```bash
curl -X POST http://localhost:8080/api/v1/fraud/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_12345",
    "amount": 1500.00,
    "user_id": "user_123",
    "merchant_id": "merchant_456",
    "quantum_features": true
  }'
```

Response:
```json
{
  "transaction_id": "txn_12345",
  "fraud_score": 0.92,
  "confidence": 0.85,
  "risk_level": "high",
  "processing_method": "quantum",
  "processing_time_ms": 45,
  "quantum_advantage": 0.15,
  "recommendation": "review"
}
```

---

## 🛠️ Development

### Prerequisites
- Go 1.21+
- Docker & Docker Compose
- Node.js 18+ (for website)
- PostgreSQL 15+
- Redis 7+

### Local Development
```bash
# Backend
go run cmd/api-server/main.go

# Website
cd web/marketing
npm install
npm run dev

# Tests
go test ./...
```

---

## 🎯 Quick Verification

Check if everything is ready for production:

```bash
./check-production.sh
```

Expected output:
```
🚀 QuantumBeam Production Readiness Check
==========================================

📦 Backend Production Features:
✓ Production wrapper service
✓ Production integration tests
✓ Health check handlers

🐳 Docker & Deployment:
✓ Production Dockerfile
✓ Production Docker Compose
✓ Environment template
✓ Quick deployment script

📚 Documentation:
✓ Production README
✓ Deployment summary
✓ Platform deployment guides
✓ Production checklist

🌐 Website:
✓ Marketing website
✓ Homepage component
✓ Website styles
✓ Design documentation

💾 Database:
✓ Database directory
✓ Migrations directory
✓ Database init script

==========================================
Results: ✓ 18 passed, ✗ 0 failed

✅ PRODUCTION READY!
```

---

## 📁 Project Structure

```
quantumbeam/
├── cmd/                    # Application entry points
│   ├── api-server/        # Main API server
│   ├── migrate/           # Database migrations
│   └── hello-server/      # Test server
│
├── internal/              # Internal packages
│   ├── fraud/            # Fraud detection services
│   │   ├── production_features.go      # Production wrapper
│   │   ├── service_production_test.go  # Integration tests
│   │   └── health_handlers.go          # Health endpoints
│   ├── models/           # Data models
│   ├── auth/             # Authentication
│   └── monitoring/       # Observability
│
├── web/                  # Frontend applications
│   └── marketing/       # Next.js website (Qodo style)
│
├── database/            # Database configuration
│   ├── migrations/     # SQL migrations
│   ├── schemas/        # Database schemas
│   └── seeds/          # Seed data
│
├── k8s/                # Kubernetes manifests
├── scripts/            # Deployment scripts
└── docs/               # Documentation
```

---

## 💰 Cost Estimates

| Scale | Infrastructure | Website | Total/month |
|-------|----------------|---------|-------------|
| **Small** (1K req/day) | Railway: $25 | Vercel Free | **~$25** |
| **Medium** (100K req/day) | Cloud Run: $150 | Vercel Pro: $20 | **~$170** |
| **Enterprise** (1M+ req/day) | Kubernetes: $500+ | CDN: $100 | **~$650+** |

---

## 🆘 Support

- **Documentation**: See [START_HERE.md](START_HERE.md) for navigation
- **Quick Deploy**: Run `./QUICK_DEPLOY.sh`
- **Verify Status**: Run `./check-production.sh`
- **Platform Guides**: See [DEPLOY_TO_PRODUCTION.md](DEPLOY_TO_PRODUCTION.md)
- **Email**: support@quantumbeam.io

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🙏 Acknowledgments

- Built with Go, Next.js, and Docker
- Experimental quantum-simulator prototype inspired by IBM Qiskit and AWS Braket (not in scoring path)
- UI design inspired by Qodo.ai
- Monitoring powered by Prometheus and Grafana

---

<div align="center">

**Ready to deploy?**

```bash
./QUICK_DEPLOY.sh
```

**Need guidance?**

Read [START_HERE.md](START_HERE.md)

**Made with ❤️ for the future of fraud detection**

</div>
