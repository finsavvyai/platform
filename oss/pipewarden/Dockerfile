FROM golang:1.26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache gcc musl-dev sqlite-dev

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY pkg/ ./pkg/

RUN CGO_ENABLED=1 go build \
    -a -installsuffix cgo \
    -ldflags="-s -w" \
    -o pipewarden ./cmd/pipewarden && \
    CGO_ENABLED=1 go build \
    -ldflags="-s -w" \
    -o pw-migrate ./cmd/migrate

FROM alpine:3.19

RUN apk add --no-cache ca-certificates sqlite-libs && \
    addgroup -S pipewarden && adduser -S pipewarden -G pipewarden

WORKDIR /app

COPY --from=builder /app/pipewarden .
COPY --from=builder /app/pw-migrate /usr/local/bin/pw-migrate
COPY configs/ ./configs/
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    mkdir -p /app/data && chown -R pipewarden:pipewarden /app

USER pipewarden

EXPOSE 8080

ENV PIPEWARDEN_SERVER_PORT=8080 \
    PIPEWARDEN_DATABASE_DRIVER=sqlite \
    PIPEWARDEN_DATABASE_PATH=/app/data/pipewarden.db \
    PIPEWARDEN_LOGGING_LEVEL=info

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["./pipewarden"]
