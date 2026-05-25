# Build stage — Go 1.24 (matches go.mod)
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git make

WORKDIR /build

# Cache deps first
COPY go.mod go.sum* ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal
COPY api ./api
COPY pkg ./pkg
COPY migrations ./migrations

# Build with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o aegis-seed ./cmd/seed
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o aegis-migrate ./cmd/migrate

# Runtime stage — minimal image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /build/api .
COPY --from=builder /build/aegis-seed ./bin/aegis-seed
COPY --from=builder /build/aegis-migrate ./bin/aegis-migrate
COPY migrations ./migrations

# Expose API + pprof (pprof only accessible internally)
EXPOSE 8080 6060

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./api"]
