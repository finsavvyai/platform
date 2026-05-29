FROM golang:1.22 AS build
WORKDIR /src
COPY . .
RUN go build -o /out/gateway main.go

FROM gcr.io/distroless/base-debian12
COPY --from=build /out/gateway /gateway
EXPOSE 8080
ENTRYPOINT ["/gateway"]
