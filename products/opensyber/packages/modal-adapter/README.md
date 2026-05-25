# @opensyber/modal-adapter

Sidecar integration package for sending Modal runtime security signals into OpenSyber.

## Install

```bash
pnpm add @opensyber/modal-adapter
```

## Usage

```ts
import { createModalAdapterClient } from '@opensyber/modal-adapter';

const client = createModalAdapterClient({
  baseUrl: 'https://api.opensyber.cloud',
  apiToken: process.env.OPENSYBER_API_TOKEN!,
  instanceId: process.env.OPENSYBER_INSTANCE_ID!,
});

await client.reportAttestation({
  eventType: 'runtime_attestation_passed',
  severity: 'info',
  details: 'Modal sandbox integrity checks passed.',
});
```

## Notes

- This package is intentionally minimal for v0.1.
- Future versions add helpers for Modal Sandbox lifecycle hooks and structured event schemas.

