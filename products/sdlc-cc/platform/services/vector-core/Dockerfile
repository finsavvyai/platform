# Production Dockerfile for Vector Core Service (Rust)
FROM rust:1.80-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src target/release/deps/vector_core*

COPY src ./src
COPY benches ./benches
RUN cargo build --release

# Runtime
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libpq5 \
    libssl3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash --uid 1001 appuser

COPY --from=builder --chown=appuser:appuser /app/target/release/vector-core /usr/local/bin/vector-core

USER appuser

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8002/health || exit 1

CMD ["vector-core"]

LABEL org.opencontainers.image.title="SDLC Vector Core" \
      org.opencontainers.image.description="pgvector + hybrid search" \
      org.opencontainers.image.source="https://github.com/sdlc-ai/platform"
