# Production Dockerfile for Gateway Service
# Multi-stage build for minimal final image size

# Stage 1: Build
FROM golang:1.25-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    git \
    ca-certificates \
    tzdata \
    make

# Create appuser
RUN adduser -D -u 1001 appuser

# Set working directory
WORKDIR /app

# Copy go mod files and download dependencies (better layer caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build arguments for versioning
ARG VERSION=1.0.0
ARG BUILD_TIME
ARG GIT_COMMIT

# Build the application binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.version=${VERSION} -X main.buildTime=${BUILD_TIME} -X main.gitCommit=${GIT_COMMIT}" \
    -a -installsuffix cgo \
    -o gateway-server \
    ./cmd/server

# Verify the binary
RUN ./gateway-server --version

# Stage 2: Production Image
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    curl \
    tzdata \
    && update-ca-certificates

# Create non-root user
RUN adduser -D -u 1001 appuser

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/gateway-server .
COPY --from=builder --chown=appuser:appuser /app/gateway-server /app/gateway-server

# Copy configuration files
COPY --from=builder --chown=appuser:appuser /app/config.yaml ./config.yaml
COPY --from=builder --chown=appuser:appuser /app/migrations ./migrations

# Set proper permissions
RUN chmod +x /app/gateway-server

# Switch to non-root user
USER appuser

# Expose ports
# 8080 - Main HTTP API
# 9090 - Prometheus metrics
EXPOSE 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["./gateway-server"]

# Image metadata
LABEL maintainer="SDLC Platform Team <team@sdlc.cc>" \
    version="1.0.0" \
    description="SDLC Platform Gateway Service" \
    org.opencontainers.image.title="SDLC Gateway" \
    org.opencontainers.image.description="API Gateway for SDLC Platform" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.source="https://github.com/sdlc-ai/platform"
