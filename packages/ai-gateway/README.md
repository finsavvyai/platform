# @finsavvyai/ai-gateway

AI gateway. Provider routing, retries, semantic cache, model selection.

Exports `AiGateway`, `InMemorySemanticCache`, types: `ProviderAdapter`, `ModelRef`, `GatewayRequest`, `GatewayResponse`, `SemanticCache`.

## Selection logic

- Match adapter on `tier` first.
- Fall back to first adapter on no match.
- Retry up to `maxAttempts` (default 3).
- Cache when `cacheKey` provided and cache configured.
