---
name: cf
displayName: Cloudflare Deploy (shortcut)
description: "Shortcut: Automated Cloudflare setup and deploy → /luna-cloudflare-auto"
version: 1.0.0
category: deployment
agent: luna-cloudflare
parameters:
  - name: scope
    type: string
    description: Service to deploy (workers, pages, d1, r2, all)
    required: true
    prompt: true
---

# /cf — Cloudflare Deploy

Shortcut for `/luna-cloudflare-auto`.

Automated Cloudflare setup with Wrangler — Workers, Pages, D1, R2, KV.

## Usage

```
/cf
```
