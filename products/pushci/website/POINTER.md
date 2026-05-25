# push-ci.dev — Symlink Alias

## Status

`portfolio/push-ci.dev` is a **symlink** to `portfolio/pushci/` in the source
portfolio repository (verified 2026-05-25 via `readlink`).

```
$ readlink /Users/shaharsolomon/dev/projects/portfolio/push-ci.dev
pushci
```

## What this means

There is no separate `push-ci.dev` content to migrate. The marketing website
already lives inside `pushci/` itself:

- `web/landing/` — Vite + React landing site (the `push-ci.dev` deployment target)
- `web/dashboard/` — authenticated app dashboard
- `Formula/` — Homebrew tap formula
- `marketing/` — campaign assets

## Action

No bulk copy under `products/pushci/website/`. The actual website source is at:

```
products/pushci/web/landing/
```

This `website/` directory is reserved for any future website-specific docs or
config that is independent of the React app source.

Source addendum reference: §3 — "push-ci.dev CORE → merge into products/pushci/website/ — Symlink alias today; consolidate"
