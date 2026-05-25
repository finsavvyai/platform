# ClawPipe SDK Deprecations

This document is the source of truth for APIs scheduled for removal in
the next major version (v4.0.0). The codemod at
`tools/migrate-v3-to-v4.mjs` rewrites callers; CI verifies that every
`@deprecated` JSDoc tag in `src/` has a matching entry here.

## Status

The current line is **3.6.x**. No public APIs are scheduled for
removal yet. This file exists so the deprecation lane is wired before
we need it — adding a `@deprecated` tag without an entry here will
fail `npm test` (the `deprecation-lint` check enforces parity).

## Process

1. Annotate the API in source with a JSDoc `@deprecated` block:
   ```ts
   /**
    * @deprecated since 3.7.0 — use {@link newName} instead. Removed in 4.0.0.
    */
   export function oldName() { /* ... */ }
   ```
2. Add a row in the table below (one per deprecated symbol).
3. If a mechanical rewrite exists, add a transform to
   `tools/migrate-v3-to-v4.mjs` so callers can migrate with
   `npx clawpipe-migrate-v3-to-v4 ./src`.
4. Land the breaking removal in the next major. The migration row
   moves from "Active" to "Removed" once the major ships.

## Deprecation Table

| Symbol | Since | Removed in | Replacement | Codemod |
|--------|-------|------------|-------------|---------|
| _(none yet)_ | — | — | — | — |

## Enforcement

`deprecation-lint.test.ts` walks `src/` for `@deprecated` JSDoc tags
and asserts that every match maps to a row in the "Active" rows of
the table above. CI rejects PRs that add a `@deprecated` annotation
without updating this file.
