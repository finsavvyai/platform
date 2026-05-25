# Multi-stage build: compile stage
FROM golang:1.21-alpine AS builder
WORKDIR /build
RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.Version=${VERSION} -X main.Build=${BUILD_ID}" \
    -o /build/quantumbeam ./cmd/server/main.go

# Final stage: minimal scratch image
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /build/quantumbeam /app/quantumbeam

EXPOSE 8080
ENV TZ=UTC
ENTRYPOINT ["/app/quantumbeam"]
