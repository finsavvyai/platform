# LAM System - Large Action Model Augmented SDLC

A comprehensive compliance intelligence platform that uses Large Action Models (LAM) to provide autonomous, learning-based compliance monitoring and enforcement.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)

### Installation
```bash
# Clone and navigate to the services directory
cd /path/to/SDLC/services

# Install dependencies
npm install

# Run tests
npm test

# Deploy to development
npm run deploy
```

## 📋 Architecture Overview

The LAM System consists of several integrated components:

### Core Services
- **LAM Core Intelligence** (`lam-core-intelligence.js`) - Central orchestration
- **Knowledge Base** (`lam-knowledge-base.js`) - RAG-powered compliance knowledge
- **Feedback Loop** (`lam-feedback-loop.js`) - Continuous learning system
- **Pattern Sharing** (`lam-pattern-sharing.js`) - Cross-product learning
- **Monitoring Dashboard** (`lam-monitoring-dashboard.js`) - Real-time monitoring

### Intelligent Agents
- **Policy Learner** (`agents/policy-learner.js`) - Learns compliance patterns
- **Risk Assessor** (`agents/risk-assessor.js`) - Real-time risk assessment
- **Provider Router** (`agents/provider-router.js`) - Intelligent AI provider selection

### Integration Layer
- **LAM System** (`lam-system.js`) - Main orchestration service
- **API Handler** (`index.js`) - Cloudflare Workers entry point

## 🛠 Configuration

### Environment Variables
```bash
# Basic Configuration
ENVIRONMENT=development
DEBUG=true

# LAM Configuration
LAM_AUTONOMOUS_MODE=false
LEARNING_INTERVAL=30m
LEARNING_BATCH_SIZE=50
SHARING_MODE=disabled
PRIVACY_LEVEL=medium

# Service Enablement
POLICY_LEARNER=enabled
RISK_ASSESSOR=enabled
PROVIDER_ROUTER=enabled
```

### Cloudflare Workers Secrets
```bash
# API Keys (set via wrangler)
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put AWS_ACCESS_KEY_ID
wrangler secret put AWS_SECRET_ACCESS_KEY
```

## 📡 API Endpoints

### Process Request
```bash
curl -X POST https://your-worker.workers.dev/api/v1/lam/process \
  -H "Content-Type: application/json" \
  -d '{
    "request": {
      "type": "compliance_check",
      "data": {
        "text": "User data to process",
        "contentType": "text",
        "sensitivity": "low"
      }
    },
    "context": {
      "userId": "user-123",
      "framework": "GDPR",
      "region": "US",
      "industry": "technology"
    }
  }'
```

### Health Check
```bash
curl https://your-worker.workers.dev/api/v1/health
```

### Get Statistics
```bash
curl https://your-worker.workers.dev/api/v1/stats
```

### Get Dashboard Data
```bash
curl https://your-worker.workers.dev/api/v1/dashboard
```

## 🧪 Testing

### Run Integration Tests
```bash
# Run all tests
npm test

# Run tests with file watching
npm run test:watch

# Run specific test functions
node -e "
import { testRequestProcessing, testHealthMonitoring } from './test-lam-system.js';
// Test specific functions
"
```

### Test Locally
```bash
# Start development server
npm run dev

# Test API endpoints in another terminal
curl http://localhost:8787/api/v1/health
```

## 🚀 Deployment

### Development Environment
```bash
# Deploy to development
npm run deploy
```

### Staging Environment
```bash
# Deploy to staging
npm run deploy:staging
```

### Production Environment
```bash
# Deploy to production
npm run deploy:prod
```

### Automated Deployment
```bash
# Use the deployment script
./deploy.sh development
./deploy.sh production
```

## 📊 Monitoring

### Real-time Dashboard
Access the monitoring dashboard at `/api/v1/dashboard` to see:
- System health status
- Agent performance metrics
- Learning cycle progress
- Pattern sharing statistics
- Risk assessment trends

### Log Streaming
```bash
# Stream logs from deployed worker
npm run tail
```

### Health Monitoring
The system automatically monitors:
- Service availability
- Response times
- Error rates
- Learning effectiveness
- Pattern discovery progress

## 🔧 Services Configuration

### Knowledge Base
- **Vector Store**: Configurable embedding storage
- **Chunk Size**: 1000 characters with 200 overlap
- **Similarity Threshold**: 0.7 for retrieval
- **Sources**: Regulatory texts, audit logs, best practices

### Feedback Loop
- **Learning Interval**: 30 minutes to 24 hours
- **Batch Size**: 10-1000 executions per cycle
- **Safety Checks**: Human approval for critical changes
- **Rollback**: Automatic rollback on failures

### Pattern Sharing
- **Mode**: Federated, centralized, or hybrid
- **Privacy Level**: High, medium, or low anonymization
- **Sync Interval**: 1-24 hours
- **Min Confidence**: 0.8 for pattern sharing

## 🛡️ Security Features

### Data Protection
- Automatic PII detection and redaction
- Configurable data anonymization
- Zero-knowledge pattern sharing
- Regional data residency compliance

### Access Control
- Role-based permissions
- API key authentication
- Session management
- Audit trail for all actions

### Compliance Frameworks
- **GDPR**: EU data protection
- **HIPAA**: Healthcare data privacy
- **FINRA**: Financial regulations
- **PCI-DSS**: Payment card security

## 📈 Performance Metrics

### Response Times
- Target: <100ms for simple requests
- Acceptable: <500ms for complex analysis
- Monitoring: Real-time performance tracking

### Learning Effectiveness
- Pattern discovery rate
- Policy improvement accuracy
- False positive/negative rates
- Cross-product adaptation speed

### System Health
- Service availability: >99.9%
- Error rate: <0.1%
- Learning cycle success: >95%

## 🔄 Integration Examples

### JavaScript/TypeScript
```javascript
import { LAMSystem } from './lam-system.js';

const lamSystem = new LAMSystem({
  environment: 'production',
  services: {
    coreIntelligence: true,
    knowledgeBase: true,
    feedbackLoop: true
  }
});

await lamSystem.initialize(env);

const result = await lamSystem.processRequest(request, context);
```

### Python Integration
```python
import requests

# Process request through LAM system
response = requests.post('https://your-worker.workers.dev/api/v1/lam/process', json={
    'request': {
        'type': 'compliance_check',
        'data': {'text': 'User data'}
    },
    'context': {
        'userId': 'user-123',
        'framework': 'GDPR'
    }
})

result = response.json()
```

## 🐛 Troubleshooting

### Common Issues

1. **Initialization Failed**
   - Check environment variables
   - Verify Cloudflare authentication
   - Ensure KV namespaces exist

2. **High Response Times**
   - Check agent health status
   - Review learning cycle frequency
   - Monitor system resources

3. **Pattern Learning Not Working**
   - Verify feedback loop is enabled
   - Check minimum occurrence thresholds
   - Review confidence settings

4. **API Authentication Errors**
   - Verify API secrets are set
   - Check request headers
   - Ensure CORS is configured

### Debug Mode
Enable debug logging by setting `DEBUG=true` in environment variables.

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [LAM Architecture Guide](../docs/)
- [Compliance Frameworks](../compliance-platform/)
- [API Reference](../docs/api.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the monitoring dashboard
- Review the API documentation
- Contact the development team

---

**Built with ❤️ by the SDLC Team**