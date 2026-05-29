# SDLC.AI Consolidation TODO

Extracted from `products/queryflux/sdlc-ai/` on 2026-05-29. Brought across as 1,444 files via `git mv` (history preserved).

## Open questions

- [ ] `services/lam-pattern-sharing.js` registers `'queryflux'` as a federation peer (lines 15, 558). This is a string identifier in a cross-product LAM pattern registry, NOT a code import or path coupling. Decide whether sdlc-ai should remain in the same LAM federation as queryflux or evolve its own registry. Listed here for completeness; no action required to unblock the extraction.
- [ ] Confirm sdlc-ai's own `package.json` workspace globs (`services/*`, `shared/libs/*`, `tools/*`, `examples/*`) still resolve correctly now that it's no longer nested under queryflux. Run `npm install` once from `products/sdlc-ai/` to verify.
- [ ] Re-measure file-size compliance against portfolio rule (≤200 lines/file). Pre-move QA report flagged 7 files >1,900 lines inside this tree (e.g. `packages/sdk-go/pkg/sdln/test_comprehensive.go`); these now belong to sdlc-ai's own remediation backlog, not queryflux.
- [ ] Decide on CI integration: extract sdlc-ai's own pipelines from `.github/workflows/` so platform-level CI doesn't try to run them under the queryflux path.
- [ ] Author a proper `CLAUDE.md` extension that conforms strictly to the portfolio template (mission/target user/architecture constraints/test matrix/security controls/release checklist). Current `CLAUDE.md` is the upstream project doc with a one-line "Extends" reference grafted on; a future agent should consolidate.
