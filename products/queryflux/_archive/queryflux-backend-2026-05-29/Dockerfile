FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /queryflux-api ./cmd/api

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /queryflux-api /usr/local/bin/queryflux-api

USER appuser

EXPOSE 8080

ENTRYPOINT ["queryflux-api"]
