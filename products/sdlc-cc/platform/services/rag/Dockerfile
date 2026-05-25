# Production Dockerfile for RAG Service (Python 3.11, FastAPI)
# Multi-stage build: separate build deps from runtime image

FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --user --no-warn-script-location -r requirements.txt

# Runtime stage
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/home/appuser/.local/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash --uid 1001 appuser

WORKDIR /app

COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser requirements.txt ./

USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "4"]

LABEL org.opencontainers.image.title="SDLC RAG Service" \
      org.opencontainers.image.description="RAG / pgvector / embedding pipeline" \
      org.opencontainers.image.source="https://github.com/sdlc-ai/platform"
