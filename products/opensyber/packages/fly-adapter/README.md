# @opensyber/fly-adapter

Sidecar integration package for forwarding Fly.io runtime security signals to OpenSyber.

## Install

```bash
pnpm add @opensyber/fly-adapter
```

## Usage

```ts
import { createFlyAdapterClient } from '@opensyber/fly-adapter';

const client = createFlyAdapterClient({
  baseUrl: 'https://api.opensyber.cloud',
  apiToken: process.env.OPENSYBER_API_TOKEN!,
  instanceId: process.env.OPENSYBER_INSTANCE_ID!,
  appName: process.env.FLY_APP_NAME,
});

await client.report({
  eventType: 'runtime_seccomp_block',
  severity: 'warning',
  details: 'Blocked syscall inside Fly runtime.',
});
```

## Notes

- v0.1 focuses on event forwarding and basic tagging.
- Next versions will include helper middleware for common Fly request/worker hooks.

