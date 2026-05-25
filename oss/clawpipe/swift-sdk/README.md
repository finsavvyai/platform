# ClawPipe Swift SDK

The intelligent AI pipeline for Apple platforms.

**Booster -> Packer -> Cache -> Gateway**

Cut LLM costs 30-50 % without changing your application logic.

## Requirements

- Swift 5.9+
- macOS 13+ or iOS 16+

## Installation

### Swift Package Manager

```swift
// In Package.swift
dependencies: [
    .package(url: "https://github.com/clawpipe/swift-sdk", from: "1.0.0")
]
```

Or add via Xcode: **File > Add Package Dependencies** and paste the repository URL.

## Quick start

```swift
import ClawPipe

let pipe = ClawPipeClient(apiKey: "cp_your_key_here")

// Boosted locally — no LLM call, zero cost
let math = try await pipe.prompt("what is 2 + 2")
print(math.text)     // "4"
print(math.boosted)  // true
print(math.tokensIn) // 0

// Real LLM call routed through the gateway
let answer = try await pipe.prompt("Explain quantum entanglement in one sentence")
print(answer.text)
print(answer.tokensIn, answer.tokensOut)
print(answer.latencyMs)
```

## Pipeline stages

| Stage   | Description                                          |
|---------|------------------------------------------------------|
| Booster | Resolves 6 prompt patterns locally without LLM calls |
| Packer  | Compresses context — collapses whitespace, deduplicates blocks |
| Cache   | SHA-256-keyed in-process cache with TTL expiry       |
| Gateway | URLSession POST to `api.clawpipe.ai/v1/prompt`       |

## Booster rules

| Rule      | Example prompt                   | Example response       |
|-----------|----------------------------------|------------------------|
| Math      | `what is 6 * 7`                  | `42`                   |
| Date      | `what is today`                  | `2026-04-22T...Z`      |
| UUID      | `generate a uuid`                | `550e8400-...`         |
| Uppercase | `convert "hello" to uppercase`   | `HELLO`                |
| Lowercase | `convert "HELLO" to lowercase`   | `hello`                |
| Reverse   | `reverse "hello"`                | `olleh`                |

## API reference

### `ClawPipeClient`

```swift
public final class ClawPipeClient {
    public init(apiKey: String, projectId: String = "default", session: URLSession = .shared)
    public func prompt(_ text: String, provider: String = "openai", model: String = "auto") async throws -> PipelineResult
}
```

### `PipelineResult`

```swift
public struct PipelineResult {
    public let text: String
    public let tokensIn: Int
    public let tokensOut: Int
    public let latencyMs: Double
    public let boosted: Bool
    public let cached: Bool
}
```

### Individual stages

Use each stage directly if you need fine-grained control:

```swift
let booster = Booster()
let answer  = booster.boost("generate a uuid")   // Optional<String>

let packer  = Packer()
let packed  = packer.pack(longContext)           // PackResult

let cache   = Cache()
await cache.set("prompt", "response", ttl: 600)
let hit     = await cache.get("prompt")          // Optional<String>
```

## Testing

```bash
cd swift-sdk
swift test
```

## License

MIT. Copyright 2026 ClawPipe.
