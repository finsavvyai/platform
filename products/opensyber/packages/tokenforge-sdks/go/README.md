# TokenForge Go SDK

Device-bound ECDSA P-256 session security for Go microservices and AI agents.

## Install

```bash
go get github.com/opensyber/tokenforge-go
```

## Quick Start

```go
package main

import (
    "fmt"
    "net/http"
    tf "github.com/opensyber/tokenforge-go"
)

func main() {
    // In-memory keys (ephemeral agents)
    client, _ := tf.NewClient("tf_your_api_key", "")
    client.Bind()

    // Auto-signing HTTP client
    httpClient := &http.Client{
        Transport: client.RoundTripper(),
    }
    resp, _ := httpClient.Get("https://api.example.com/data")
    fmt.Println(resp.Status)
}
```

## Persistent Keys

```go
// Keys persist to ~/.tokenforge/key.pem
client, _ := tf.NewClient("tf_your_api_key", "~/.tokenforge")
client.Bind()
```

## AI Agent Example

```go
package main

import (
    "log"
    "net/http"
    tf "github.com/opensyber/tokenforge-go"
)

func main() {
    client, err := tf.NewClient("tf_your_api_key", "")
    if err != nil {
        log.Fatal(err)
    }
    if err := client.Bind(); err != nil {
        log.Fatal(err)
    }

    // All requests through this transport are signed
    httpClient := &http.Client{Transport: client.RoundTripper()}

    // Agent makes API calls with device-bound signatures
    resp, err := httpClient.Post(
        "https://api.example.com/agent/execute",
        "application/json",
        nil,
    )
    if err != nil {
        log.Fatal(err)
    }
    defer resp.Body.Close()
    log.Println("Status:", resp.Status)
}
```

## Manual Signing

```go
req, _ := http.NewRequest("GET", "https://api.example.com/data", nil)
client.SignRequest(req)
// req now has X-TF-Signature, X-TF-Nonce, X-TF-Timestamp, X-TF-Device-ID
```

## How It Works

1. Generates ECDSA P-256 keypair using `crypto/ecdsa`
2. Optionally persists key to PEM file
3. Signs `{sessionId}:{nonce}:{timestamp}` with ECDSA-SHA256
4. Registers public key via `POST /v1/bind`
5. `RoundTripper()` auto-signs all requests via `http.Client` transport

## API

| Function | Description |
|----------|-------------|
| `NewClient(apiKey, keyDir)` | Create client (empty keyDir = in-memory) |
| `client.Bind()` | Register device with API |
| `client.SignRequest(req)` | Sign an `*http.Request` |
| `client.GetHeaders()` | Get signed headers map |
| `client.RoundTripper()` | `http.RoundTripper` for auto-signing |
