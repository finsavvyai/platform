# Multi-stage build for embedding service
FROM python:3.11-slim as builder

# Set build arguments
ARG BUILDKIT_INLINE_CACHE=1

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONHASHSEED=random

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r embeddinguser && useradd -r -g embeddinguser embeddinguser

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim as production

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONHASHSEED=random
ENV PATH="/home/embeddinguser/.local/bin:$PATH"

# Install runtime system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Create non-root user
RUN groupadd -r embeddinguser && useradd -r -g embeddinguser embeddinguser

# Set working directory
WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Create necessary directories
RUN mkdir -p /app/models /app/logs /app/uploads && \
    chown -R embeddinguser:embeddinguser /app

# Copy application code
COPY --chown=embeddinguser:embeddinguser ./app ./app
COPY --chown=embeddinguser:embeddinguser ./app/core/config.py ./app/core/
COPY --chown=embeddinguser:embeddinguser ./app/api/main.py ./app/api/

# Copy configuration files
COPY --chown=embeddinguser:embeddinguser .env.example .env

# Create entrypoint script
RUN cat > /app/entrypoint.sh << 'EOF'
#!/bin/bash
set -e

# Wait for Redis to be ready
if [ -n "$REDIS_URL" ]; then
    echo "Waiting for Redis..."
    python -c "
import asyncio
import redis.asyncio as redis
async def wait_for_redis():
    client = redis.from_url('$REDIS_URL')
    while True:
        try:
            await client.ping()
            print('Redis is ready!')
            break
        except:
            print('Redis not ready, waiting...')
            await asyncio.sleep(1)
    await client.close()
asyncio.run(wait_for_redis())
"
fi

# Start the application
echo "Starting embedding service..."
exec uvicorn app.api.main:app --host 0.0.0.0 --port 8003
EOF

RUN chmod +x /app/entrypoint.sh && chown embeddinguser:embeddinguser /app/entrypoint.sh

# Switch to non-root user
USER embeddinguser

# Expose port
EXPOSE 8003

# Set health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command
CMD []
