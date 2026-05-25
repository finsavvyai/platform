# SDLC Arena

A public CTF-style arena where anyone can try to bypass [sdlc-guard](https://huggingface.co/sdlc-ai/sdlc-guard-v1) — our open-source prompt-injection / jailbreak / PII-leak detector. Every successful bypass becomes labelled training data for the next release.

Live at [sdlc.cc/arena](https://sdlc.cc/arena).

## Why

Most "AI security" benchmarks are static and stale within months. We want a live target with public scoring so:

- Researchers can stress-test the guard model in the open and earn leaderboard credit.
- The training corpus stays fresh: today's bypass is tomorrow's training example.
- The OWASP LLM Top 10 working group has reproducible empirical data instead of vibes.

## Architecture

```
        player ──▶ Next.js arena (sdlc.cc/arena)
                       │
                       ▼
              POST /api/score
                       │
                       ├─▶ scoreRemote() ──▶ sdlc-guard endpoint
                       │     (falls back to local heuristic in dev)
                       │
                       └─▶ judge() ──▶ verdict { detected, bypassed, points }
                                          │
                                          ▼
                                    daily snapshot ─▶ HF dataset
```

## Files

| Path | Purpose |
|------|---------|
| `data/challenges.json` | The 5 starter challenges — system prompt, objective, guard threshold, points |
| `data/attacks-v1.jsonl` | Seed dataset; grows nightly from arena submissions |
| `apps/web/pages/index.tsx` | Leaderboard + challenge list |
| `apps/web/pages/play/[challenge].tsx` | CTF interface |
| `apps/web/pages/api/score.ts` | Scoring endpoint — runs guard + judge |
| `apps/web/lib/guard.ts` | Guard inference client (remote with local heuristic fallback) |
| `apps/web/lib/scoring.ts` | Pure judge() function — guard score + objective → points |

## Run locally

```bash
cd apps/web
npm install
npm test            # 12/12 unit tests on guard + judge
npm run dev         # http://localhost:3000
```

The local heuristic kicks in automatically when `GUARD_ENDPOINT` is unset, so the arena UX works end-to-end without the model.

## Submissions → labelled dataset

A nightly job (TBD) reads new arena rows from Postgres, scrubs PII, and appends to `data/attacks-v1.jsonl`. Every two weeks we cut a release of `sdlc-ai/attacks-v1` on HuggingFace Datasets.

## Roadmap

- [x] Five starter challenges
- [x] Local heuristic guard (12/12 unit tests)
- [x] Pure scoring rules (12/12 unit tests)
- [ ] Hosted sdlc-guard-v1 (DeBERTa-v3-base fine-tune) on HF
- [ ] Server-side LLM grader (judges whether attempt actually achieved objective)
- [ ] Persistent leaderboard (currently stateless)
- [ ] OWASP LLM Top 10 working-group submission with arena results
