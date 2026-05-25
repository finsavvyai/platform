# QueryFlux Backend Dockerfile
FROM golang:1.24-alpine AS builder
RUN apk add --no-cache git ca-certificates tzdata gcc musl-dev
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o queryflux-backend ./cmd/server/main.go
FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata curl libc6-compat
RUN addgroup -g 1001 -S queryflux && adduser -u 1001 -S queryflux -G queryflux
WORKDIR /app
COPY --from=builder /app/queryflux-backend .
RUN mkdir -p /app/data /app/logs && chown -R queryflux:queryflux /app
USER queryflux
EXPOSE 8080
HEALTHCHECK CMD curl -f http://localhost:8080/health || exit 1
ENTRYPOINT ["./queryflux-backend"]
