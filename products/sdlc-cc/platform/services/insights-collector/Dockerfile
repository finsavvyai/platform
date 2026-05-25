FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN CGO_ENABLED=0 go build -o /out/collector ./cmd/collector

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/collector /collector
USER nonroot:nonroot
ENTRYPOINT ["/collector"]
