# QuantumBeam Development Environment

This document provides comprehensive instructions for setting up and using the QuantumBeam development environment with Docker Compose.

## Prerequisites

- Docker Desktop 4.0+ or Docker Engine 20.10+
- Docker Compose v2.0+
- Make (optional, for convenient commands)
- At least 8GB RAM (16GB recommended)
- 10GB free disk space

## Quick Start

### Option 1: Using the Development Script (Recommended)

```bash
# Start all services
./scripts/dev.sh start

# View service URLs
./scripts/dev.sh urls

# View logs
./scripts/dev.sh logs

# Stop all services
./scripts/dev.sh stop
```

### Option 2: Using Make Commands

```bash
# Start all services
make dev

# Check service status
make status

# Test connectivity
make test

# Stop all services
make down
```

### Option 3: Using Docker Compose Directly

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Services Overview

The development environment includes the following services:

### Core Services

| Service | Port | Description | Credentials |
|---------|------|-------------|-------------|
| API Service | 8080 | Main Go API server | - |
| Quantum Service | 8001 | Python quantum computing service | - |
| ML Service | 8002 | Python machine learning service | - |

### Databases

| Service | Port | Description | Credentials |
|---------|------|-------------|-------------|
| PostgreSQL | 5432 | Primary database | postgres/password |
| Redis | 6379 | Cache and session store | - |
| InfluxDB | 8086 | Time-series data | admin/password123 |
| Elasticsearch | 9200 | Search and analytics | - |

### Management UIs

| Service | Port | URL | Credentials |
|---------|------|-----|-------------|
| PgAdmin | 5050 | http://localhost:5050 | admin@quantumbeam.dev / admin |
| Redis Commander | 8081 | http://localhost:8081 | admin / admin |
| Kibana | 5601 | http://localhost:5601 | - |
| MinIO Console | 9001 | http://localhost:9001 | minioadmin / minioadmin123 |
| Grafana | 3000 | http://localhost:3000 | admin / admin |

### Monitoring

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Prometheus | 9091 | http://localhost:9091 | Metrics collection |
| Jaeger | 16686 | http://localhost:16686 | Distributed tracing |
| API Health | 8082 | http://localhost:8082/health | API health check |
| API Metrics | 9090 | http://localhost:9090/metrics | API metrics |

## Development Features

### Hot Reload

All services are configured for hot reload during development:

- **Go API Service**: Uses Air for automatic rebuild and restart
- **Python Services**: Use Uvicorn with `--reload` flag

Changes to source code will automatically trigger a rebuild/restart.

### Volume Mounts

The following directories are mounted for development:

- `./cmd`: Go application entry points
- `./internal`: Go internal packages
- `./services/quantum`: Python quantum service
- `./services/ml`: Python ML service
- `./config`: Configuration files
- `./migrations`: Database migrations

### Environment Configuration

Development environment uses the configuration from `config/config.development.yaml`.

## Common Development Tasks

### Database Management

```bash
# Run migrations
make migrate

# Connect to PostgreSQL
make shell-postgres

# Connect to Redis
make shell-redis

# Reset database (WARNING: deletes all data)
make reset-db
```

### Testing

```bash
# Test all service connectivity
make test

# Test specific service endpoints
make test-services

# Quick API endpoint test
make quick-test
```

### Viewing Logs

```bash
# View all logs
make logs

# View specific service logs
make logs-api
make logs-postgres
make logs-quantum
make logs-ml
```

### Development Utilities

```bash
# Open shell in API service container
make shell

# Open shell in Quantum service
make shell-quantum

# Open shell in ML service
make shell-ml

# Show all service URLs
make urls

# Open monitoring dashboards
make monitor

# Open admin interfaces
make admin
```

## Service APIs

### API Service (Port 8080)

- Health Check: `GET http://localhost:8082/health`
- Metrics: `GET http://localhost:9090/metrics`
- Profiling: `http://localhost:6060/debug/pprof/`

### Quantum Service (Port 8001)

- Health Check: `GET http://localhost:8001/health`
- Ready Check: `GET http://localhost:8001/ready`
- Compute: `POST http://localhost:8001/compute`
- Algorithms: `GET http://localhost:8001/algorithms`

#### Example Quantum Request

```bash
curl -X POST http://localhost:8001/compute \
  -H "Content-Type: application/json" \
  -d '{
    "data": [1, 2, 3, 4, 5],
    "algorithm": "vqc",
    "parameters": {
      "layers": 2,
      "entanglement": "full"
    }
  }'
```

### ML Service (Port 8002)

- Health Check: `GET http://localhost:8002/health`
- Ready Check: `GET http://localhost:8002/ready`
- Predict: `POST http://localhost:8002/predict`
- Models: `GET http://localhost:8002/models`

#### Example ML Request

```bash
curl -X POST http://localhost:8002/predict \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_data": {
      "amount": 1000,
      "time_of_day": 14,
      "merchant_category": "electronics",
      "customer_age": 35
    },
    "model_version": "latest",
    "include_explainability": true
  }'
```

## Database Schema

### PostgreSQL Tables

- `users`: User accounts and profiles
- `api_keys`: API authentication keys
- `transactions`: Financial transactions
- `fraud_results`: Fraud detection results

### InfluxDB

- Database: `quantumbeam`
- Bucket: `metrics`
- Measurements: `transactions`, `model_predictions`, `quantum_computations`

### Elasticsearch Indices

- `transactions`: Transaction documents for search
- `audit_logs`: Audit trail
- `ml_models`: ML model metadata

## Development Workflow

1. **Start Environment**
   ```bash
   make dev
   ```

2. **Make Changes**
   - Edit source code
   - Services automatically reload

3. **Test Changes**
   ```bash
   make test
   ```

4. **View Logs**
   ```bash
   make logs-api
   ```

5. **Debug**
   ```bash
   make shell
   ```

6. **Stop Environment**
   ```bash
   make down
   ```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :8080
   
   # Stop the conflicting service
   make down
   ```

2. **Services Not Starting**
   ```bash
   # Check logs
   docker-compose logs
   
   # Reset environment
   make clean
   make dev
   ```

3. **Out of Memory**
   - Increase Docker Desktop memory allocation to 8GB+
   - Stop unused services: `docker-compose stop kibana grafana`

4. **Permission Issues**
   ```bash
   # Fix directory permissions
   sudo chown -R $USER:$USER .
   ```

### Health Checks

All services include health checks. Monitor status with:

```bash
# Check all services
docker-compose ps

# Check specific service
docker-compose exec api-service curl http://localhost:8082/health
```

### Performance Monitoring

- **Grafana**: http://localhost:3000 - Visualize metrics
- **Prometheus**: http://localhost:9091 - Raw metrics
- **Jaeger**: http://localhost:16686 - Request tracing

## Cleanup

### Complete Reset

```bash
# Stop and remove everything
make clean

# Or manually
docker-compose down -v --rmi all
docker system prune -f
```

### Selective Cleanup

```bash
# Remove volumes only (keeps images)
docker-compose down -v

# Remove images only (keeps volumes)
docker-compose down --rmi all
```

## Production Deployment

The development environment is optimized for local development. For production deployment:

1. Use `Dockerfile` instead of `Dockerfile.dev`
2. Use `docker-compose.prod.yml`
3. Enable all security features
4. Configure proper secrets management
5. Set up monitoring and alerting

## Additional Resources

- [API Documentation](http://localhost:8080/docs) - Swagger/OpenAPI docs
- [Grafana Dashboards](http://localhost:3000) - Pre-configured dashboards
- [Kibana Dev Tools](http://localhost:5601/app/dev_tools) - Elasticsearch queries
- [Project Wiki](./docs) - Detailed documentation

## Getting Help

1. Check the logs: `make logs`
2. Run connectivity tests: `make test`
3. Check service status: `make status`
4. Review troubleshooting section above
5. Open an issue in the project repository