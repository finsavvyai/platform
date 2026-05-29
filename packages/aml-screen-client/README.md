# @finsavvyai/aml-screen-client

Typed TypeScript client for the AMLIQ sanctions-screening public-demo endpoint
(`POST /api/v1/screen/public-demo`).

This package provides:

- `ScreenClient` — production fetch-based client with timeout + error mapping.
- `MockScreenClient` — deterministic in-memory client for tests and local dev.
- Strict request / response types.

## Usage

```ts
import { ScreenClient } from "@finsavvyai/aml-screen-client";

const client = new ScreenClient({ baseUrl: "http://localhost:8080" });
const result = await client.screen({ name: "Vladimir Putin", pep: true });
```

## Errors

- `ScreenClientError` — network failure, non-2xx response, or malformed JSON.
- `ScreenTimeoutError` — request exceeded `timeoutMs` (extends `ScreenClientError`).

## Critical path

Network + decoding lives in `client.ts`. Coverage target: 100% lines, ≥95% branches.
