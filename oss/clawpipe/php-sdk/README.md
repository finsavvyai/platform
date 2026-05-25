# ClawPipe PHP SDK

> Cut LLM costs 30-50% with one line of code.

The ClawPipe PHP SDK implements the full intelligence pipeline:

```
Request → Booster → Packer → Cache → Gateway
```

## Requirements

- PHP 8.0+
- ext-curl (standard with PHP)
- ext-json (standard with PHP)

## Installation

```bash
composer require clawpipe/clawpipe-ai
```

## Quick Start

```php
use ClawPipe\Client;

$pipe = new Client(['api_key' => 'cp_your_key_here']);

// Deterministic answers skip the LLM entirely
$result = $pipe->prompt('What is 2 + 2?');
echo $result['text'];        // "4"
echo $result['boosted'];     // true  (answered locally)
echo $result['savings_pct']; // 100.0

// Complex prompts route through the full pipeline
$result = $pipe->prompt('Summarise this article: ...');
echo $result['text'];
echo $result['cached'];      // true on subsequent identical calls
echo $result['tokens_in'];
echo $result['tokens_out'];
echo $result['latency_ms'];
```

## Pipeline Stages

### Booster — deterministic rules (no LLM)

| Rule | Example Input | Output |
|------|--------------|--------|
| Math | `what is 6 * 7` | `42` |
| Date | `what is today` | `2026-04-22T...` |
| UUID | `generate a uuid` | `550e8400-...` |
| Uppercase | `convert "hello" to uppercase` | `HELLO` |
| Lowercase | `convert "HELLO" to lowercase` | `hello` |
| Reverse | `reverse "hello"` | `olleh` |

### Packer — context compression

Collapses redundant whitespace, removes duplicate paragraph blocks, and truncates to a configurable token budget.

### Cache — in-memory TTL cache

SHA-256 keyed, 5-minute default TTL, LRU eviction at capacity.

### Gateway — HTTP client

Dispatches to `https://api.clawpipe.ai/v1/prompt` using ext-curl (no Guzzle).

## Configuration

```php
$pipe = new Client([
    'api_key'          => 'cp_xxx',       // required — ClawPipe project key
    'provider'         => 'openai',        // default: openai
    'model'            => 'gpt-4o-mini',   // default: gpt-4o-mini
    'provider_api_key' => 'sk-...',        // your provider key (forwarded to gateway)
    'gateway_url'      => 'https://api.clawpipe.ai/v1',
    'booster'          => true,            // default: true
    'packer'           => true,            // default: true
    'cache'            => true,            // default: true
    'cache_ttl'        => 300,             // seconds, default: 300
]);
```

## Cache Management

```php
$stats = $pipe->cache()->stats();
// ['size' => 12, 'hits' => 5, 'misses' => 3, 'hit_rate' => '62.5%']

$pipe->cache()->clear();   // flush all
$pipe->cache()->prune();   // remove expired entries only
```

## Running Tests

```bash
cd php-sdk
composer install
./vendor/bin/phpunit
```

## License

MIT
