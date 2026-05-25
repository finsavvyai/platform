# Production Dockerfile for Universal Dependency Platform

# Use Python 3.11 slim image
FROM python:3.11-slim as builder

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH=/app/src

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Copy Poetry configuration files
COPY pyproject.toml poetry.lock ./

# Install dependencies (only main for production)
RUN poetry config virtualenvs.create false \
    && poetry install --no-dev --only main

# Production stage
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH=/app/src

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed dependencies from builder stage
COPY --from=builder /root/.local/lib/python3.11/site-packages /root/.local/lib/python3.11/site-packages
COPY --from=builder /root/.local/bin /root/.local/bin

# Copy application code
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY scripts/ ./scripts/

# Create directories and set permissions
RUN mkdir -p /app/logs /app/uploads \
    && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8040

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8040/health || exit 1

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Wait for database\n\
echo "Waiting for database..." \n\
while ! curl -f "$DATABASE_URL" 2>/dev/null; do \n\
    echo "Database is unavailable - sleeping" \n\
    sleep 1 \n\
done \n\
\n\
# Run database migrations \n\
echo "Running database migrations..." \n\
poetry run alembic upgrade head \n\
\n\
# Start the application \n\
echo "Starting UPM server..." \n\
exec poetry run uvicorn udp.api.main:app \\\
    --host 0.0.0.0 \\\
    --port 8040 \\\
    --workers $(nproc) \\\
    --max-requests 1000 \\\
    --max-requests-jitter 100 \\\
    --timeout 120 \\\
    --graceful-timeout 30 \\\
    --access-log \\\
    --error-log \\\
    --log-level info' > /app/startup.sh && \
    chmod +x /app/startup.sh

# Set command
ENTRYPOINT ["/app/startup.sh"]
