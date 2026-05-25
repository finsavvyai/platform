# ClawPipe Go SDK

The intelligent AI pipeline for Go. **Booster -> Pack -> Cache -> Route -> Call -> Learn.**

ClawPipe sits between your app and LLM providers. Cut costs 30-50% without changing application logic.

## Install

```bash
go get github.com/finsavvyai/clawpipe-go
```

Requires Go 1.21+. Zero external dependencies (stdlib only).

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    clawpipe "github.com/finsavvyai/clawpipe-go"
)

func main() {
    pipe := clawpipe.New(clawpipe.Config{
        APIKey:    "cp_xxx",
        ProjectID: "my-app",
    })

    result, err := pipe.Prompt(context.Background(), "Calculate 42 * 2", nil)
    if err != nil {
        panic(err)
    }
    fmt.Println(result.Text)         // "84"
    fmt.Println(result.Meta.Boosted) // true (resolved locally, zero cost)
}
```

## Pipeline Stages

1. **Booster** -- deterministic transforms that skip LLM calls (JSON, math, date, units, UUID, base64)
2. **Packer** -- compress context to reduce token count
3. **Cache** -- hash-based prompt deduplication with TTL + LRU
4. **Router** -- complexity-aware model selection across 8 providers
5. **Gateway** -- HTTP dispatch to ClawPipe gateway
6. **Learner** -- track outcomes and refine routing weights

## Configuration

```go
clawpipe.Config{
    APIKey:        "cp_xxx",       // required
    ProjectID:     "my-app",       // required
    GatewayURL:    "https://...",  // default: api.clawpipe.ai/v1
    CacheTTLMs:    300000,         // default: 5 minutes
    CacheMax:      10000,          // max cache entries
    EnableBooster: true,           // default: true
    EnablePacker:  true,           // default: true
    EnableCache:   true,           // default: true
}
```

## Telemetry

```go
stats := pipe.Stats()
fmt.Printf("Requests: %d, Cost: $%.4f, Cache hit rate: %s\n",
    stats.TotalRequests, stats.TotalCostUsd, stats.CacheHitRate)
```

## License

MIT
