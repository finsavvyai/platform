# FinSavvy Cluster — Migration Notes

## Source

| Source path | SHA | Date | Size | Target |
|---|---|---|---|---|
| /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm | 60ffbd4a | 2026-05-25 | 9.7M | products/finsavvy-cluster/ |

## Promotion decision (May 2026 ranking memo, 2026-05-25)

Originally missed by the consolidation plan. Surfaced by the May 2026 cross-folder ranking as:
- Top-ranked project in entire portfolio (89/88 in Feb 2026 assessment)
- Uses FinSavvyAI brand name in product
- Last commit 2026-05-13 (active)
- Never reviewed in addendum §3

Founder promoted to 9th CORE product alongside QueryFlux (8th).

## Mission

**FinSavvy Distributed AI Cluster** — power-user oriented distributed LLM inference: home computers + AWS-style CLI + intelligent model routing.

## Market position

Crowded market (Ollama 169K stars / 2.5B downloads dominates; vLLM owns production). Niche differentiator:
- AWS-CLI familiarity (target ops/SRE persona, not ML researchers)
- Multi-machine clustering for home/small-team setups (not single-node like Ollama, not cloud-managed like vLLM)
- Brand alignment with FinSavvyAI infra story

This is a power-user/SMB niche, not a category leader play.

## Exclusions

Standard rsync excludes: node_modules, dist, build, .git, .wrangler, .next, .open-next, .venv, venv, __pycache__, vendor, coverage, *.log, .env*, *LEAKED*, secrets.enc.

## Layout (as imported)

```
products/finsavvy-cluster/
├── cloudflare-api/        (CF Worker API surface)
├── config/                (cluster config schemas)
├── deploy/                (deploy scripts)
├── desktop-app/           (cross-platform desktop client)
├── docs/                  
├── finsavvy-cluster/      (core cluster engine — likely needs rename to avoid nesting)
├── finsavvyai/            (CLI client?)
├── finsavvyai-menubar/    (macOS menubar app)
├── install_bash_cli.sh
├── ios-app/               (mobile client)
├── LICENSE                (preserved)
├── main.py                (entrypoint)
└── README.source.md       (upstream README preserved)
```

## Known issues

- Nested `finsavvy-cluster/` subdir creates `products/finsavvy-cluster/finsavvy-cluster/` — needs un-nesting in CONSOLIDATION_TODO.
- LICENSE present (preserved from source).
- Multiple client surfaces (desktop, menubar, iOS, CLI) — overlaps with QueryFlux's multi-surface play; may benefit from shared design-system patterns later.

## Source preservation

Original at `/02_AI_AGENTS/llm/` untouched.
