# ClawPipe Elixir SDK

> Cut LLM costs 30-50% with one line of code.

The ClawPipe pipeline in Elixir: **Booster → Packer → Cache → Gateway**.

## Installation

```elixir
# mix.exs
def deps do
  [{:clawpipe_ai, "~> 3.6"}]
end
```

## Quick start

```elixir
{:ok, result} = ClawPipe.Client.prompt("What is 2 + 2?", api_key: "cp_xxx")
IO.puts result.text       # "4"
IO.puts result.boosted    # true  — answered locally, no LLM call
IO.puts result.cached     # false
IO.puts result.savings_pct # 100.0
```

## Pipeline stages

| Stage    | Module                | What it does                                   |
|----------|-----------------------|------------------------------------------------|
| Booster  | `ClawPipe.Booster`    | 6 deterministic rules — skip LLM entirely      |
| Packer   | `ClawPipe.Packer`     | Compress context to cut token count            |
| Cache    | `ClawPipe.Cache`      | SHA-256 keyed GenServer cache with TTL         |
| Gateway  | `ClawPipe.Gateway`    | HTTP dispatch to `api.clawpipe.ai`             |

### Booster rules

1. **Math** — `what is 6 * 7` → `"42"`
2. **Date** — `what is today` → `"2026-04-22"`
3. **UUID** — `generate a uuid` → `"xxxxxxxx-xxxx-4xxx-..."`
4. **Uppercase** — `convert "hello" to uppercase` → `"HELLO"`
5. **Lowercase** — `convert "HELLO" to lowercase` → `"hello"`
6. **Reverse** — `reverse "hello"` → `"olleh"`

### Packer

```elixir
result = ClawPipe.Packer.pack(long_text)
IO.puts result.text        # compressed text
IO.puts result.savings_pct # e.g. 12.3
```

### Cache

```elixir
ClawPipe.Cache.set("Who wrote Hamlet?", "Shakespeare")
{:ok, "Shakespeare"} = ClawPipe.Cache.get("Who wrote Hamlet?")
ClawPipe.Cache.stats()
# %{size: 1, hits: 1, misses: 0, hit_rate: "100.0%"}
```

### Gateway

```elixir
{:ok, resp} = ClawPipe.Gateway.call(
  "Explain quantum entanglement",
  "openai",
  "gpt-4o-mini",
  System.fetch_env!("CLAWPIPE_API_KEY")
)
IO.puts resp.text
```

## Client options

| Option         | Default         | Description                             |
|----------------|-----------------|-----------------------------------------|
| `:api_key`     | *required*      | Your ClawPipe API key                   |
| `:provider`    | `"openai"`      | LLM provider                            |
| `:model`       | `"gpt-4o-mini"` | Model name                              |
| `:ttl`         | `300`           | Cache TTL in seconds                    |
| `:base_url`    | gateway URL     | Override for local testing              |
| `:skip_boost`  | `false`         | Bypass deterministic booster            |
| `:skip_cache`  | `false`         | Bypass cache lookup and storage         |
| `:skip_pack`   | `false`         | Bypass context packer                   |

## Running tests

```bash
cd elixir-sdk
mix deps.get
mix test
```

## License

MIT — see root LICENSE file.
