# clawpipe-ai (Ruby SDK)

Cut LLM costs 30-50% with one line of code.

```ruby
require 'clawpipe'

pipe = ClawPipe::Client.new(api_key: 'cp_xxx')
result = pipe.prompt('What is 2 + 2?')
puts result[:text]              # => "4"
puts result[:savings][:boosted] # => true  (no LLM call made)
```

## Pipeline Stages

```
Request -> Booster -> Packer -> Cache -> Gateway
```

| Stage   | What it does                                         |
|---------|------------------------------------------------------|
| Booster | Deterministic answers — math, dates, UUID, strings   |
| Packer  | Compresses context to reduce token count             |
| Cache   | SHA-256 keyed in-memory TTL cache                    |
| Gateway | Net::HTTP POST to api.clawpipe.ai (no external gems) |

## Installation

```bash
gem install clawpipe-ai
```

Or add to your Gemfile:

```ruby
gem 'clawpipe-ai'
```

## Usage

```ruby
require 'clawpipe'

# All pipeline stages enabled by default
pipe = ClawPipe::Client.new(
  api_key: 'cp_xxx',
  cache_ttl: 300,         # seconds (default: 300)
  enable_booster: true,
  enable_packer: true,
  enable_cache: true
)

result = pipe.prompt(
  'Explain quantum entanglement',
  provider: 'openai',
  model: 'gpt-4o-mini'
)

puts result[:text]
puts result[:meta][:tokens_in]
puts result[:meta][:estimated_cost_usd]
puts result[:savings][:cost_saved]
```

## Booster Rules (resolved locally, zero tokens)

| Prompt pattern                        | Result             |
|---------------------------------------|--------------------|
| `what is 6 * 7`                       | `42`               |
| `what is today`                       | `2026-04-22`       |
| `generate a uuid`                     | `uuid-v4-string`   |
| `convert "hello" to uppercase`        | `HELLO`            |
| `convert "WORLD" to lowercase`        | `world`            |
| `reverse "hello"`                     | `olleh`            |

## Cache Stats

```ruby
stats = pipe.cache_stats
puts stats.hit_rate   # => "85.0%"
puts stats.hits       # => 42
puts stats.size       # => 7
```

## Requirements

- Ruby >= 3.0
- No runtime gem dependencies (stdlib only: `net/http`, `json`, `digest`, `securerandom`, `date`)

## Development

```bash
bundle install
bundle exec rspec
```

## License

MIT
