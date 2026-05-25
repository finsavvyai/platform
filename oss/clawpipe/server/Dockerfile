# ── Stage 1: dependency builder ──────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: lean runtime ─────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL org.opencontainers.image.title="FinSavvyAI" \
      org.opencontainers.image.description="Self-hosted distributed AI gateway — OpenAI-compatible" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/finsavvyai/finsavvyai"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system finsavvyai \
    && adduser --system --ingroup finsavvyai --no-create-home finsavvyai

COPY --from=builder /install /usr/local

COPY src/ src/
COPY main.py .
COPY pyproject.toml .

RUN mkdir -p logs && chown -R finsavvyai:finsavvyai /app

USER finsavvyai

# ── Default environment ───────────────────────────────────────────────────────
ENV FINSAVVYAI_GATEWAY_HOST=0.0.0.0 \
    FINSAVVYAI_GATEWAY_PORT=8080 \
    FINSAVVYAI_MASTER_HOST=localhost \
    FINSAVVYAI_MASTER_PORT=8000 \
    FINSAVVYAI_LOG_LEVEL=INFO \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Default: start the API gateway (routes to cloud providers or cluster workers)
# Override with: docker run ... python3 -m src.core.start_master
CMD ["python3", "-m", "src.api.gateway"]
