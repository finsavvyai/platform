# syntax=docker/dockerfile:1.7
# Multi-stage build → final image is distroless and ~12 MB.

FROM golang:1.23-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath -ldflags="-s -w" \
    -o /out/sdlc-gateway ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/sdlc-gateway /sdlc-gateway

EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/sdlc-gateway"]
