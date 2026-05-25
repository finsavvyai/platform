# Deployment Troubleshooting Guide

## Current Issues

### 1. Docker Build I/O Errors
**Symptom:** `exec /bin/sh: input/output error` during Docker build

**Possible Causes:**
- Docker Desktop resource constraints
- Docker daemon instability
- Disk space issues
- Network issues during image pull

**Solutions:**
```bash
# 1. Restart Docker Desktop completely
# 2. Increase Docker Desktop resources (Settings > Resources)
#    - Memory: At least 4GB
#    - CPUs: At least 2
#    - Disk: At least 20GB free

# 3. Clean Docker cache
docker system prune -a

# 4. Try building without cache
docker-compose -f docker-compose.prod.yml build --no-cache

# 5. Build services individually
docker-compose -f docker-compose.prod.yml build postgres
docker-compose -f docker-compose.prod.yml build redis
docker-compose -f docker-compose.prod.yml build backend
```

### 2. Environment Variables Not Loading
**Symptom:** Warnings about variables not being set

**Solutions:**
```bash
# Option 1: Export variables before running
export $(grep -v '^#' .env.production | xargs)
docker-compose -f docker-compose.prod.yml up -d

# Option 2: Use env_file in docker-compose (already configured)
# Make sure .env.production has no spaces around = signs
# Format: KEY=value (not KEY = value)

# Option 3: Source the file
source .env.production
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Alternative: Use Development Compose First
If production build continues to fail, test with development setup:

```bash
# Use development compose to verify everything works
docker-compose up -d

# Then migrate to production
docker-compose down
docker-compose -f docker-compose.prod.yml up -d
```

## Quick Fix Commands

### Fix Environment Variables
```bash
# Ensure proper format (no spaces, no quotes unless needed)
sed -i '' 's/^\([^=]*\) = /\1=/' .env.production
sed -i '' 's/^\([^=]*\)= /\1=/' .env.production
```

### Clean and Rebuild
```bash
# Stop everything
docker-compose -f docker-compose.prod.yml down -v

# Clean build cache
docker builder prune -a -f

# Rebuild
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Check Docker Resources
```bash
# Check Docker info
docker info | grep -E "Total Memory|CPUs|Storage"

# Check disk space
df -h
```

## Recommended Next Steps

1. **Restart Docker Desktop** - Often fixes I/O errors
2. **Increase Docker Resources** - Settings > Resources in Docker Desktop
3. **Try Development Compose First** - Verify basic functionality
4. **Build Services Individually** - Isolate the problematic service
5. **Check Logs** - `docker-compose logs` for specific errors

## Manual Deployment Steps

If automated deployment continues to fail:

1. **Start Infrastructure Services First:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d postgres redis chromadb
   ```

2. **Wait for them to be healthy:**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

3. **Run migrations:**
   ```bash
   docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
   ```

4. **Start application services:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d backend celery-worker celery-beat
   ```

5. **Start monitoring:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d prometheus grafana
   ```

## Getting Help

If issues persist:
1. Check Docker Desktop logs
2. Review `docker-compose logs` for specific service errors
3. Verify `.env.production` file format
4. Ensure Docker has sufficient resources
5. Try deploying services one at a time

