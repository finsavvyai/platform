# Build context expectation: parent directory containing both
#   ./sdlc-cc/  (this repo)
#   ./sdlc-core/ (private sibling, resolved via go.mod replace)
#
#   docker build -f sdlc-cc/deploy/Dockerfile -t sdlc-api .
#
# CI handles the sibling clone via SDLC_CORE_TOKEN; for prod release
# pipelines, do the same checkout-then-build flow.

FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git
WORKDIR /build

# Both modules into the build context. Order matters: sdlc-core first
# so the replace directive in sdlc-cc/go.mod can resolve at `go mod
# download` time.
COPY sdlc-core/ ./sdlc-core/
COPY sdlc-cc/   ./sdlc-cc/

WORKDIR /build/sdlc-cc

RUN go mod download

# Three binaries shipped together: the gateway, the migration runner
# (one-shot init container), and keytool (operator CLI). Same trimmed
# build flags so all three are reproducible + minimal.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/sdlc-api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/keytool ./cmd/keytool

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget && \
    addgroup -S sdlc && adduser -S sdlc -G sdlc

WORKDIR /app
COPY --from=builder /out/sdlc-api /out/migrate /out/keytool ./
COPY sdlc-cc/migrations/ ./migrations/

USER sdlc

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

LABEL org.opencontainers.image.source="https://github.com/finsavvyai/sdlc-cc"
LABEL org.opencontainers.image.title="sdlc-api"
LABEL org.opencontainers.image.description="sdlc.cc compliance LLM gateway"
LABEL org.opencontainers.image.licenses="proprietary"

# Default to the gateway. Operators run migrations + keytool by
# overriding CMD:
#   docker run --rm -e DATABASE_URL=... sdlc-api ./migrate -dir ./migrations
#   docker run --rm -e DATABASE_URL=... sdlc-api ./keytool issue --tenant tnt_x
CMD ["./sdlc-api"]
