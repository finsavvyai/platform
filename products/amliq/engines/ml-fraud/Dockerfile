# Multi-stage Dockerfile for QuantumBeam
# This Dockerfile creates a production-ready container image with security best practices

# Build stage
FROM golang:1.25-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    ca-certificates \
    git \
    make \
    gcc \
    musl-dev \
    sqlite-dev \
    curl

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build arguments
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_DATE=unknown
ARG ENVIRONMENT=production

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.version=${VERSION} -X main.commit=${COMMIT} -X main.buildDate=${BUILD_DATE} -X main.environment=${ENVIRONMENT}" \
    -a -installsuffix cgo \
    -o quantumbeam \
    ./cmd/api-server

# Runtime stage
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    jq \
    sqlite \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S quantumbeam && \
    adduser -u 1001 -S quantumbeam -G quantumbeam

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/quantumbeam /usr/local/bin/quantumbeam

# Copy configuration files
COPY --chown=quantumbeam:quantumbeam configs/ /app/config/

# Create necessary directories
RUN mkdir -p /app/data /app/logs /app/tmp && \
    chown -R quantumbeam:quantumbeam /app

# Set permissions
RUN chmod +x /usr/local/bin/quantumbeam

# Switch to non-root user
USER quantumbeam

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Run the application
CMD ["quantumbeam"]