# Claude Agent Platform - Development Environment

This guide covers setting up and using the Claude Agent Platform development environment.

## Quick Start

1. **Prerequisites**
   - Docker Desktop 4.20+ or Docker Engine 24+
   - Node.js 20+
   - Git
   - Make (optional)

2. **Initial Setup**
   ```bash
   # Clone and navigate to the project
   cd claude-agent
   
   # Run the setup validation
   ./scripts/test-setup.sh
   
   # Start the development environment
   ./scripts/dev-start.sh
   ```

3. **Access Services**
   - Web App: http://localhost:3000
   - API Server: http://localhost:3001
   - Luna Agents: http://localhost:3002
   - Grafana: http://localhost:3001 (admin/claude_password)
   - Prometheus: http://localhost:9090
   - Database Admin: http://localhost:15672 (claude_user/claude_password)

## Architecture Overview

The development environment consists of:

### Core Services
- **PostgreSQL** (Port 5432): Primary database
- **Redis** (Port 6379): Cache and session storage
- **RabbitMQ** (Port 5672): Message queue
- **Elasticsearch** (Port 9200): Full-text search
- **Qdrant** (Port 6333): Vector database
- **MinIO** (Port 9000): Object storage

### Application Services
- **API Gateway** (Port 3001): Main API server
- **Luna Agents** (Port 3002): AI agent orchestration
- **Web Application** (Port 3000): React web interface

### Monitoring & Management
- **Prometheus** (Port 9090): Metrics collection
- **Grafana** (Port 3001): Visualization dashboards
- **Jaeger** (Port 16686): Distributed tracing
- **Redis Commander** (Port 8081): Redis management
- **MailHog** (Port 8025): Email testing

## Development Workflow

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys
vim .env

# Validate setup
./scripts/test-setup.sh

# Start services
./scripts/dev-start.sh
```

### 2. Development

```bash
# View logs
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Restart specific service
docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart api-dev

# Debug application
# Connect to localhost:9229 for API debugging
# Connect to localhost:9230 for Luna Agents debugging
```

### 3. Database Management

```bash
# Access PostgreSQL
docker exec -it claude-agent-postgres psql -U claude_user -d claude_agent

# View Prisma Studio
open http://localhost:5555

# Run migrations
cd packages/database && pnpm migrate:dev
```

### 4. Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run integration tests
pnpm test:integration
```

## Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# Database
DATABASE_URL=postgresql://claude_user:claude_password@localhost:5432/claude_agent

# Cache
REDIS_URL=redis://:redis_password@localhost:6379

# Message Queue
RABBITMQ_URL=amqp://claude_user:claude_password@localhost:5672/claude_vhost

# Search & Storage
ELASTICSEARCH_URL=http://localhost:9200
QDRANT_URL=http://localhost:6333
MINIO_URL=http://localhost:9000

# AI Services
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
HUGGINGFACE_API_KEY=your_huggingface_key

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
```

### Service Configuration

Each service has its own configuration:

- **Redis**: `redis/redis.conf`
- **RabbitMQ**: `rabbitmq/rabbitmq.conf`
- **Elasticsearch**: `elasticsearch/elasticsearch.yml`
- **Qdrant**: `qdrant/config.yaml`
- **Prometheus**: `monitoring/prometheus/prometheus.yml`
- **Grafana**: `monitoring/grafana/provisioning/`

## Useful Commands

### Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Start specific services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis

# Stop all services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# Stop and remove volumes
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v

# View service status
docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps

# View resource usage
docker stats
```

### Development Tools

```bash
# Access API server logs
docker logs claude-agent-api-dev -f

# Access database shell
docker exec -it claude-agent-postgres psql -U claude_user -d claude_agent

# Access Redis CLI
docker exec -it claude-agent-redis redis-cli -a redis_password

# Access RabbitMQ management
open http://localhost:15672
```

### Package Management

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Clean build artifacts
pnpm clean

# Lint code
pnpm lint

# Format code
pnpm format
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using a port
   lsof -i :3000
   
   # Stop conflicting services
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
   ```

2. **Database Connection Issues**
   ```bash
   # Check PostgreSQL status
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps postgres
   
   # Restart database
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart postgres
   ```

3. **Memory Issues**
   ```bash
   # Check Docker memory usage
   docker system df
   
   # Clean up unused containers
   docker system prune
   ```

4. **Service Startup Failures**
   ```bash
   # View service logs
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs [service-name]
   
   # Check service health
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps
   ```

### Performance Optimization

1. **Increase Docker Memory**
   - Docker Desktop: Settings → Resources → Memory (8GB+ recommended)

2. **Optimize Database**
   ```bash
   # Check PostgreSQL connections
   docker exec claude-agent-postgres psql -U claude_user -d claude_agent -c "SELECT count(*) FROM pg_stat_activity;"
   ```

3. **Monitor Resources**
   ```bash
   # Open Grafana dashboards
   open http://localhost:3001
   ```

## Contributing

### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write tests for new functionality
- Update documentation

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
pnpm test
pnpm lint

# Commit and push
git add .
git commit -m "feat: add new feature"
git push origin feature/your-feature
```

### Development Tips

1. **Hot Reload**: All development services support hot reload
2. **Debugging**: Use VS Code Docker extension for debugging
3. **Database**: Use Prisma Studio at http://localhost:5555 for database management
4. **Monitoring**: Check Grafana dashboards for system metrics
5. **Logs**: Use `docker-compose logs -f` to follow service logs

## Support

- **Documentation**: Check `/docs` directory for detailed guides
- **Issues**: Report bugs and feature requests on GitHub
- **Community**: Join our Discord server for discussions
- **Email**: Contact development team at dev@claude-agent.com

## Production Deployment

For production deployment, see `/docs/deployment.md` for detailed instructions on setting up the platform in a production environment.