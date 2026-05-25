# luna-dockerize - Project Containerization Command

## Command Overview

The `luna-dockerize` command provides comprehensive Docker containerization for your project with optimized multi-stage builds, Docker Compose orchestration, and production-ready configurations.

## What This Command Does

- **Automated Dockerization**: Analyzes project and generates Docker configurations
- **Multi-Stage Builds**: Optimized Dockerfiles for minimal image sizes
- **Docker Compose**: Complete orchestration for all services
- **Development & Production**: Separate configurations for each environment
- **Security Best Practices**: Non-root users, health checks, security scanning
- **CI/CD Integration**: GitHub Actions workflows for Docker builds

## Usage Instructions

### Full Project Dockerization
```bash
luna-dockerize
```
Dockerizes entire project with all services.

### Specific Service
```bash
luna-dockerize service [service-name]
```
Dockerizes specific service (e.g., backend, frontend, database).

### Development Environment Only
```bash
luna-dockerize --dev
```
Generates development Docker configuration with hot reload.

### Production Environment Only
```bash
luna-dockerize --prod
```
Generates optimized production Docker configuration.

### With Kubernetes
```bash
luna-dockerize --k8s
```
Includes Kubernetes deployment configurations.

## Key Features

### Multi-Stage Builds
- **Stage 1**: Dependencies installation
- **Stage 2**: Build and compilation
- **Stage 3**: Minimal production runtime

### Docker Compose Services
- **Frontend**: React/Vue/Angular applications
- **Backend**: Node.js/Python/Go APIs
- **Database**: PostgreSQL/MySQL/MongoDB
- **Cache**: Redis/Memcached
- **Proxy**: Nginx reverse proxy
- **Queue**: RabbitMQ/Redis Queue

### Security Features
- Non-root user execution
- Read-only root filesystem
- Security scanning with Trivy
- Minimal base images (Alpine Linux)
- Secrets management
- Network isolation

### Development Features
- Hot reload for code changes
- Volume mounts for live editing
- Debug mode enabled
- Development dependencies included
- Port forwarding configured

### Production Optimizations
- Minimal image sizes (< 100MB for Node.js)
- Layer caching optimization
- Health checks configured
- Resource limits set
- Logging configured
- Restart policies

## Generated Files

```
.luna/{project}/docker/
├── Dockerfile                     # Production Dockerfile
├── Dockerfile.dev                 # Development Dockerfile
├── docker-compose.yml             # Production compose
├── docker-compose.dev.yml         # Development compose
├── docker-compose.test.yml        # Testing compose
├── .dockerignore                  # Docker ignore file
├── nginx.conf                     # Nginx configuration
├── Makefile                       # Helper commands
├── .github/workflows/
│   └── docker.yml                 # CI/CD workflow
└── k8s/                           # Kubernetes configs (optional)
    ├── deployment.yml
    ├── service.yml
    └── ingress.yml
```

## Quick Start

### 1. Dockerize Project
```bash
luna-dockerize
```

### 2. Build Images
```bash
cd .luna/{project}/docker
make build
```

### 3. Start Services
```bash
make up
```

### 4. View Logs
```bash
make logs
```

### 5. Stop Services
```bash
make down
```

## Makefile Commands

```bash
make build          # Build all Docker images
make up             # Start all services
make down           # Stop all services
make logs           # View logs
make restart        # Restart services
make clean          # Clean everything
make dev            # Start development environment
make prod           # Start production environment
make test           # Run tests in containers
make shell-backend  # Access backend shell
make shell-frontend # Access frontend shell
```

## Docker Compose Examples

### Start Development Environment
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Start Production Environment
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Scale Services
```bash
docker-compose up -d --scale backend=3
```

### View Service Status
```bash
docker-compose ps
```

## Integration with Luna Ecosystem

Works seamlessly with:
- **`luna-cloudflare-auto`** - Deploy containers to Cloudflare
- **`luna-test`** - Run tests in Docker containers
- **`luna-deploy`** - Deploy Docker images to registries
- **`luna-monitor`** - Monitor containerized applications
- **`luna-shortcuts`** - Quick Docker shortcuts

## Best Practices Applied

### Image Optimization
- Multi-stage builds reduce image size by 70%
- Alpine Linux base images (5MB vs 100MB+)
- Layer caching for faster builds
- .dockerignore excludes unnecessary files

### Security
- Non-root user execution
- Security scanning in CI/CD
- Secrets via environment variables
- Network isolation between services
- Read-only root filesystem where possible

### Performance
- Health checks for service readiness
- Resource limits prevent resource exhaustion
- Restart policies for high availability
- Connection pooling for databases
- Caching strategies implemented

### Development Experience
- Hot reload for instant feedback
- Volume mounts for live editing
- Debug mode with detailed logging
- Easy shell access to containers
- Makefile for common commands

## Troubleshooting

### Build Failures
```bash
# Clear build cache
docker builder prune -af

# Rebuild without cache
docker-compose build --no-cache
```

### Container Won't Start
```bash
# Check logs
docker-compose logs [service-name]

# Check container status
docker-compose ps
```

### Network Issues
```bash
# Recreate network
docker-compose down
docker network prune
docker-compose up
```

### Volume Issues
```bash
# Remove volumes
docker-compose down -v

# Recreate volumes
docker-compose up
```

## Quality Checklist

- [ ] Multi-stage builds implemented
- [ ] Non-root user configured
- [ ] Health checks added
- [ ] .dockerignore configured
- [ ] Environment variables externalized
- [ ] Volume mounts configured
- [ ] Network isolation implemented
- [ ] Resource limits set
- [ ] Logging configured
- [ ] Development environment working
- [ ] Production optimizations applied
- [ ] CI/CD integration ready
- [ ] Security scanning enabled

## Output Summary

After dockerization, you'll receive:
- **Dockerfiles**: Optimized multi-stage builds
- **Docker Compose**: Complete service orchestration
- **Makefile**: Easy command shortcuts
- **CI/CD**: GitHub Actions workflow
- **Documentation**: Complete usage guide
- **Kubernetes**: K8s configs (if requested)

Transform your project into production-ready containers! 🐳✨
