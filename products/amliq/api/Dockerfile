FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o bin/aegis-api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o bin/aegis-worker ./cmd/worker

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/bin/aegis-api .
COPY --from=builder /app/bin/aegis-worker .

EXPOSE 8080

ENV PORT=8080
ENV HOST=0.0.0.0

CMD ["./aegis-api"]
