# LunaOS Cloud Deployment Guide

This guide covers deploying LunaOS backend to various cloud platforms.

## 🌐 Supported Cloud Platforms

- **AWS** - Amazon Web Services
- **Google Cloud** - Google Cloud Platform  
- **Azure** - Microsoft Azure
- **DigitalOcean** - DigitalOcean App Platform
- **Railway** - Railway.app
- **Render** - Render.com
- **Heroku** - Heroku (legacy)

## 🚀 Quick Deploy Options

### 1. Railway (Recommended for Quick Start)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/lunaos)

**One-click deploy:**
```bash
# Deploy to Railway
railway login
railway init
railway up
```

### 2. Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

**Deploy via Render Dashboard:**
1. Connect GitHub repository
2. Select `lunaos` as root directory
3. Set build command: `make install`
4. Set start command: `make dev`

### 3. DigitalOcean App Platform

**Deploy via DigitalOcean:**
1. Create new app from GitHub
2. Select repository
3. Configure build settings
4. Deploy

## ☁️ Cloud-Specific Deployments

### AWS Deployment

#### Option 1: AWS App Runner
```yaml
# apprunner.yaml
version: 1.0
runtime: python3
build:
  commands:
    build:
      - pip install -r requirements.txt
run:
  runtime-version: 3.9
  command: python -m lunaos.cli run --host 0.0.0.0 --port 8000
  network:
    port: 8000
    env: PORT
  env:
    - name: PORT
      value: "8000"
```

#### Option 2: AWS ECS with Fargate
```yaml
# ecs-task-definition.json
{
  "family": "lunaos",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "lunaos-api",
      "image": "lunaos/lunaos:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "ENVIRONMENT",
          "value": "production"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/lunaos",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Platform

#### Cloud Run Deployment
```yaml
# cloud-run.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: lunaos
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/execution-environment: gen2
    spec:
      containerConcurrency: 100
      containers:
      - image: gcr.io/PROJECT_ID/lunaos:latest
        ports:
        - containerPort: 8000
        env:
        - name: PORT
          value: "8000"
        - name: ENVIRONMENT
          value: "production"
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
```

#### Deploy to Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/lunaos
gcloud run deploy lunaos --image gcr.io/PROJECT_ID/lunaos --platform managed --region us-central1 --allow-unauthenticated
```

### Microsoft Azure

#### Container Instances
```yaml
# azure-container-instance.yaml
apiVersion: 2018-10-01
location: eastus
name: lunaos
properties:
  containers:
  - name: lunaos-api
    properties:
      image: lunaos/lunaos:latest
      ports:
      - port: 8000
        protocol: TCP
      environmentVariables:
      - name: ENVIRONMENT
        value: production
      resources:
        requests:
          cpu: 0.5
          memoryInGb: 1.0
  osType: Linux
  ipAddress:
    type: Public
    ports:
    - protocol: TCP
      port: 8000
  restartPolicy: Always
type: Microsoft.ContainerInstance/containerGroups
```

#### Deploy to Azure
```bash
# Deploy to Azure Container Instances
az container create --resource-group myResourceGroup --file azure-container-instance.yaml
```

## 🐳 Docker Cloud Deployment

### Docker Compose for Production
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  lunaos-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/lunaos
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=lunaos
      - POSTGRES_USER=lunaos
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

### Deploy with Docker
```bash
# Deploy to any cloud with Docker support
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Environment Configuration

### Production Environment Variables
```bash
# .env.production
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=your-secure-secret-key
DATABASE_URL=postgresql://user:pass@host:5432/lunaos
REDIS_URL=redis://host:6379
ALLOWED_HOSTS=your-domain.com,api.your-domain.com
CORS_ORIGINS=https://your-domain.com,https://app.your-domain.com
```

### Security Settings
```bash
# Security configuration
JWT_SECRET=your-jwt-secret
JWT_ALGORITHM=HS256
JWT_EXPIRATION=3600
RATE_LIMIT_PER_MINUTE=100
MAX_REQUEST_SIZE=10485760
```

## 📊 Monitoring & Observability

### Health Checks
```bash
# Health check endpoint
curl https://your-lunaos-api.com/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2025-01-06T12:00:00Z",
  "version": "1.0.0"
}
```

### Metrics Endpoint
```bash
# Metrics endpoint
curl https://your-lunaos-api.com/metrics

# Prometheus format metrics
lunaos_requests_total{method="GET",endpoint="/health"} 150
lunaos_response_time_seconds{endpoint="/health"} 0.05
```

## 🔐 Security Best Practices

### 1. Environment Variables
- Never commit secrets to version control
- Use cloud provider secret management
- Rotate secrets regularly

### 2. Network Security
- Use HTTPS only
- Configure CORS properly
- Set up rate limiting
- Use WAF if available

### 3. Database Security
- Use connection pooling
- Enable SSL/TLS
- Regular backups
- Access controls

## 🚀 Deployment Commands

### Quick Deploy Scripts
```bash
# Deploy to Railway
make deploy-railway

# Deploy to Render
make deploy-render

# Deploy to DigitalOcean
make deploy-digitalocean

# Deploy to AWS
make deploy-aws

# Deploy to Google Cloud
make deploy-gcp

# Deploy to Azure
make deploy-azure
```

## 📱 Client Usage

### API Base URL
```bash
# Production API
export LUNAOS_API_URL="https://your-lunaos-api.com"

# Test connection
curl $LUNAOS_API_URL/health
```

### Python Client
```python
import requests

# Initialize client
api_url = "https://your-lunaos-api.com"
headers = {"Authorization": "Bearer YOUR_TOKEN"}

# Create agent
response = requests.post(
    f"{api_url}/api/agents",
    json={
        "name": "my-agent",
        "type": "chat",
        "config": {"model": "gpt-3.5-turbo"}
    },
    headers=headers
)

# Send message
response = requests.post(
    f"{api_url}/api/agents/my-agent/messages",
    json={"message": "Hello!"},
    headers=headers
)
```

### JavaScript Client
```javascript
// Initialize client
const apiUrl = "https://your-lunaos-api.com";
const headers = {
  "Authorization": "Bearer YOUR_TOKEN",
  "Content-Type": "application/json"
};

// Create agent
const agent = await fetch(`${apiUrl}/api/agents`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: "my-agent",
    type: "chat",
    config: { model: "gpt-3.5-turbo" }
  })
});

// Send message
const response = await fetch(`${apiUrl}/api/agents/my-agent/messages`, {
  method: "POST",
  headers,
  body: JSON.stringify({ message: "Hello!" })
});
```

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          railway login --token ${{ secrets.RAILWAY_TOKEN }}
          railway up
```

## 📞 Support

- **Documentation**: Check cloud-specific guides
- **Issues**: GitHub issues
- **Community**: Discord server
- **Support**: support@lunaos.ai

---

**Ready to deploy?** Choose your cloud platform and follow the specific guide! ☁️
