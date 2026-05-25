# Trust Center

Static site that surfaces the shared Trust posture for the three-product bundle:

| Product | Role |
|---|---|
| sdlc-platform | Privacy gateway (front door) |
| AMLIQ | AML compliance dashboard (vertical proof point) |
| Claw / OpenSyber | Multi-provider AI gateway (routing layer) |

## Deploy

Designed for **Cloudflare Pages**. No build step.

```bash
# Local preview
python3 -m http.server -d trust 8000
# → http://localhost:8000

# Cloudflare Pages
# Project directory: ./trust
# Build command: (none)
# Build output:    .
# Custom domain:   trust.sdlc.cc
```

`_headers` ships the strict CSP, HSTS, and frame-ancestors none.

## Pages

| Path | Purpose |
|---|---|
| `index.html` | Hub. Links into everything. |
| `security.html` | Security overview, controls inventory. |
| `sub-processors.html` | Unified sub-processor list. |
| `dpa.html` | DPA + MSA structure. |
| `audit-logs.html` | Cross-product audit-log architecture. |
| `soc2.html` | Honest current status + bridge for procurement. |

## Editing

Plain HTML + one shared `styles.css`. No framework, no build, no JS. Apple-HIG aesthetic (calm, content-first, system font, prefers-color-scheme aware). Keep it that way.
