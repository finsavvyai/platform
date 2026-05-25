# ClawPipe .NET SDK

Cut LLM costs 30-50% with one line of code.

## Install

```sh
dotnet add package ClawPipe.AI
```

## Quick start

```csharp
using ClawPipe;

var pipe = new ClawPipeClient(apiKey: "cp_xxx");

// Boosted locally — no network call
var math = await pipe.PromptAsync("what is 2 + 2");
Console.WriteLine(math.Text);    // "4"
Console.WriteLine(math.Boosted); // true

// Cached on second call
var first  = await pipe.PromptAsync("Tell me about black holes");
var second = await pipe.PromptAsync("Tell me about black holes");
Console.WriteLine(second.Cached); // true
```

## Pipeline stages

```
Prompt -> Booster -> Cache -> Packer -> Gateway -> Learn
```

| Stage   | What it does                                      |
|---------|---------------------------------------------------|
| Booster | 6 deterministic rules — answers without LLM calls |
| Cache   | SHA-256 keyed, TTL-aware, ConcurrentDictionary    |
| Packer  | Whitespace / boilerplate compression              |
| Gateway | POST https://api.clawpipe.ai/v1/prompt            |

## Booster rules

| Rule      | Example prompt                          | Response               |
|-----------|-----------------------------------------|------------------------|
| Math      | `what is 2 + 2`                         | `4`                    |
| Date      | `what is today`                         | `2026-04-22`           |
| UUID      | `generate a uuid`                       | `550e8400-...`         |
| Uppercase | `convert "hello" to uppercase`          | `HELLO`                |
| Lowercase | `convert "HELLO" to lowercase`          | `hello`                |
| Reverse   | `reverse "hello"`                       | `olleh`                |

## Custom booster rules

```csharp
pipe.Booster.AddRule(new BoosterRule(
    "ping",
    inp => inp == "ping",
    _   => "pong"
));
```

## PipelineResult

```csharp
public record PipelineResult(
    string Text,
    int    TokensIn,
    int    TokensOut,
    double LatencyMs,
    bool   Boosted,
    bool   Cached
);
```

## Options

```csharp
var pipe = new ClawPipeClient(
    apiKey: "cp_xxx",
    options: new ClawPipeOptions(
        CacheTtl: TimeSpan.FromMinutes(10),
        MaxCacheEntries: 50_000,
        PackerOptions: new PackerOptions(MaxTokens: 50_000)
    )
);
```

## Build & test

```sh
cd dotnet-sdk
dotnet build
dotnet test
```

## Requirements

- .NET 8+
- No external dependencies for core library (System.Text.Json, System.Net.Http only)

## License

MIT
