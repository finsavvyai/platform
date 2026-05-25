# pipewarden-real-archive-20260412 — Archived

**Snapshot date:** 2026-05-25
**Snapshot type:** **source snapshot** (small, 604K)
**Disposition:** pre-rewrite snapshot

## Source
- **Path:** `/Users/shaharsolomon/dev/projects/portfolio/pipewarden-real-archive-20260412/`
- **Commit SHA:** `703b7c6a692d0c9d35de8b12cac849967b8783bf`
- **Last commit:** 2026-03-06 18:50:35 +0200
- **Size on disk:** 604K
- **File count:** 59
- **Snapshot copy:** YES — full rsync (excluding standard build artifacts)
  to `_archive/portfolio-snapshots/pipewarden-real-archive-20260412/`

## README excerpt
```
# PipeWarden

Security Guardian for CI/CD Pipelines
Break free from security vulnerabilities without slowing down development

(Go project, MIT license, web dashboard mentioned)
```

## Reason for archiving (per addendum §3)
Pre-rewrite snapshot. Already named as archive in source. The live
PipeWarden code lives in `portfolio/pipewarden/` and will migrate to
`oss/pipewarden/` under the PUSHCI-OSS agent's scope (round 4).

## Overlap assessment
By design overlaps with the live pipewarden — this is the prior version.
**No risk of accidental fold-in**: directory name already encodes
"archive" status, and PUSHCI-OSS agent should ignore it.

**Note for PUSHCI-OSS agent:** if you discover regressions in the new
pipewarden that this older version handled correctly, this snapshot is
the reference point.

## Suggested final disposition
**Preserve indefinitely** alongside the new `oss/pipewarden/` package.
Tiny (604K), already labeled as archive, useful as historical reference.
This is the snapshot already-named; do not delete.
