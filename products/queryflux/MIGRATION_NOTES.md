# QueryFlux — Migration Notes

## Sources

| Source path | SHA | Date | Target |
|---|---|---|---|
| /Users/shaharsolomon/dev/projects/portfolio/queryflux-git | 5110dcf5 | 2026-05-25 | products/queryflux/ (root) |
| /Users/shaharsolomon/dev/projects/portfolio/querylens | (no .git) | 2026-05-25 | products/queryflux/lens/ |
| /Users/shaharsolomon/dev/projects/portfolio/queryflux (empty placeholder) | n/a | 2026-05-25 | skipped (0B) |

## Promotion decision (founder memo, 2026-05-24)

QueryFlux was originally flagged as `ARCHIVE → or fold` in addendum §3. The founder memo re-classified it as **8th CORE product** based on:
- 791 active source files
- Recent shipping: Tasks 11.x (SSO, Subscriptions, Security Hardening) merged within last 7 days
- Multi-surface: web + desktop + electron + mobile + MCP + vscode-ext + browser-ext + openai-app + workers + D1
- Fills the data-layer gap in the ecosystem (PushCI/Qestro/LunaOS/OpenSyber/SDLC.cc/AMLIQ all cover code/runtime/governance; nothing covered DB-for-AI-apps)

## Exclusions

Standard round-4 rsync excludes applied: `node_modules`, `dist`, `build`, `.git`, `.wrangler`, `.next`, `.open-next`, `.venv`, `venv`, `__pycache__`, `vendor`, `coverage`, `*.log`, `.env*`, `*LEAKED*`, `secrets.enc`.

## Layout (target)

```
products/queryflux/
├── (root: queryflux-git contents — web, desktop, mobile, MCP server, extensions, backend, workers)
└── lens/   (folded from /portfolio/querylens)
```

The intended logical decomposition from the memo (`web/`, `desktop/`, `mobile/`, `mcp-server/`, `lens/`, `backend/`) is **not** restructured in this pass — source had its own organization which is preserved. Restructure is a follow-up ticket in `CONSOLIDATION_TODO.md`.

## Known issues

- Source directory mixes multiple sub-products (queryflux-mcp-server, queryflux-desktop, queryflux-electron, queryflux-backend, queryflux-worker, querylens-api) under one tree. Future consolidation should hoist these into sibling subdirs at `products/queryflux/{web,desktop,mobile,mcp-server,lens,backend}/` per memo.
- LICENSE present in source (preserved).
- Recent SSO + Subscriptions code may import auth/billing primitives that overlap with `@finsavvyai/auth` and `@finsavvyai/billing`. Cross-wire in a future round; do not modify in this pass.
- Source repo had its own `.env*` files removed during rsync. Production secrets remain at `/portfolio/queryflux-git/` and must be re-pointed to Cloudflare Worker secrets on deploy.

## Source preservation

Original at `/Users/shaharsolomon/dev/projects/portfolio/queryflux-git/` and `/portfolio/querylens/` untouched. Deletion is a manual step after migration verification.
