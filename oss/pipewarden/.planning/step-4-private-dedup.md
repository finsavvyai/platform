# Step 4 — private-repo dedup (deferred)

After Steps 1–3 the **public** repo `finsavvyai/pipewarden-cli` is live
with a complete, self-contained OSS surface. The **private** repo
(`finsavvyai/pipewarden`, this repo) still contains a full copy of all
the OSS files — they have not been deleted yet.

This is intentional. The private repo continues to build and `make smoke`
PASS unchanged because Go resolves modules from the local checkout
root, ignoring any external module that would otherwise shadow them.
**External consumers only ever see the public repo** because the private
one is not published, so there is no "two modules, same path" leak.

This document records the deferred work to dedup the OSS code out of the
private tree. Estimated effort: half a day. Do it when (a) the public
module has been tagged and is available on proxy.golang.org, (b) you
have time to fix any imports broken by the rename.

---

## Why we deferred

1. The destructive rename of the private module path
   (`github.com/finsavvyai/pipewarden` → `github.com/finsavvyai/pipewarden-saas`)
   touches every Go file in the private tree.
2. Until the public repo is tagged, the private repo would have to use a
   pseudo-version of the public module — manageable but adds friction.
3. The private repo's working `make smoke` + 51-package test suite is
   load-bearing for ongoing development. Breaking it mid-week is bad.

## What needs to happen

```
1. Tag the public repo (finsavvyai/pipewarden-cli, branch main):
       git tag v0.1.0
       git push origin v0.1.0
   Goreleaser CI will fire (linux + darwin + windows tarballs +
   homebrew formula + SBOM). Verify the run is clean.

2. In the private repo (this one), rename the Go module:
       Edit go.mod line 1:
       module github.com/finsavvyai/pipewarden-saas

3. Add the public module as a dependency:
       go get github.com/finsavvyai/pipewarden@v0.1.0

4. Rewrite SaaS-package imports to the new module path:
       The SaaS packages are: ai, aianalysis, auth, billing, email,
       handlers, mesh, middleware, payment, router, search, siem,
       tracing (currently used by SaaS too), web, db, exports,
       jenkins, providers, server.
       For each, find/replace in all .go files:
         github.com/finsavvyai/pipewarden/internal/<saas-pkg>
           → github.com/finsavvyai/pipewarden-saas/internal/<saas-pkg>
       Plus cmd/pipewarden-server (the binary itself).
       The OSS-package imports STAY as github.com/finsavvyai/pipewarden/internal/<oss-pkg>
       — those now resolve to the external public module.

5. Delete the duplicated OSS files from the private tree. The list to
   `git rm -r` is exactly the path list passed to `git filter-repo`
   when populating the public repo (see open-core-split.md §4).
   After this step, /usr/bin/diff between the private tree and the
   public-extract clone should be empty in those paths.

6. `go mod tidy`, then `go build ./...` and `go test ./...` and
   `make smoke`. All three must remain green.

7. Commit:
       feat(open-core): consume public pipewarden module
       BREAKING: private module path renamed to pipewarden-saas
   Tag the private repo: `v2026.05-post-split` (or similar) so the
   "before-after" boundary is markable.
```

## Sanity-check after dedup

```
# inside private repo
go list -m all | grep pipewarden
# should show TWO modules:
#   github.com/finsavvyai/pipewarden-saas       (this repo)
#   github.com/finsavvyai/pipewarden v0.1.0     (external public module)

# no internal duplicates:
ls internal/analysis  # should not exist  → comes from public module
ls internal/handlers  # should exist      → private SaaS package
```

## Why this is safe to defer indefinitely

- External users go to `github.com/finsavvyai/pipewarden-cli` (public).
  They never see the private repo and never `go get` from it.
- Internal builds work because Go's local-package resolution wins
  over the proxy when the import path matches a directory in
  $GOPATH or the local module root.
- The only risk is "an outside contributor PRs against the private
  repo by mistake" — but the private repo isn't visible to outside
  contributors anyway.

## What's still required at the boundary

`internal/analysis/analysis.go` (the public Finding/Severity/Category
types) is the cross-repo contract. Any change there must:

1. Land first in the public repo.
2. Be released as a new tag.
3. The private repo bumps its `require` directive to the new tag.

Don't change the type signatures without considering downstream
consumers — every PR against the public repo could break a hosted
deploy if the contract drifts.
