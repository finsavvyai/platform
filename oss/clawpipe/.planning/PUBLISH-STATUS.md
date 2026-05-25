# ClawPipe SDK Publish Status

Last updated: 2026-04-08
Target version for all SDKs: **3.0.0**

---

## Summary Matrix

| Language | Registry       | Package Name         | Version | Built | Tests | Published | Action Required                |
|----------|----------------|----------------------|---------|-------|-------|-----------|--------------------------------|
| Python   | PyPI           | `clawpipe-ai`        | 3.0.0   | yes   | 97 ok | NO        | User must run `twine upload`   |
| Rust     | crates.io      | `clawpipe-ai`        | 3.0.0   | yes   | all ok| NO        | User must run `cargo publish`  |
| Go       | proxy.golang.org| `github.com/finsavvyai/clawpipe-go` | v3.0.0 | yes | all ok | NO | User must push git tag         |
| Java     | Maven Central  | `ai.clawpipe:clawpipe-sdk` | 3.0.0 | yes | ok   | NO        | Sonatype setup required        |
| Node     | npm            | `clawpipe-ai`        | ~1.0.2  | n/a   | n/a   | yes       | already published              |

> Nothing was auto-published because `.env` only contains `NPM_TOKEN`.
> No `PYPI_TOKEN` and no `CRATES_IO_TOKEN` were found, so Python and Rust
> remain queued for a single manual command each.

---

## 1. Python — PyPI

**Package:** `clawpipe-ai`
**Source:** `/Users/shaharsolomon/dev/projects/portfolio/clawpipe/python-sdk`
**Artifacts built and ready in `python-sdk/dist/`:**
- `clawpipe_ai-3.0.0-py3-none-any.whl`
- `clawpipe_ai-3.0.0.tar.gz`

**Tests:** 97 passing (booster 26, cache 14, openai_compat 29, packer 12, pipeline 6, router 10).

### To publish (user action)

1. Create an API token at https://pypi.org/manage/account/token/
   - Scope: `Entire account` (first publish) or `Project: clawpipe-ai` (subsequent).
2. Store in `/Users/shaharsolomon/dev/projects/portfolio/clawpipe/.env`:
   ```
   PYPI_TOKEN=pypi-AgEIcHlwaS5vcmcC...
   ```
3. Run:
   ```bash
   cd /Users/shaharsolomon/dev/projects/portfolio/clawpipe/python-sdk
   python3 -m twine upload dist/* \
     --username __token__ \
     --password "$PYPI_TOKEN"
   ```
4. Verify: https://pypi.org/project/clawpipe-ai/
5. Consumer install:
   ```bash
   pip install clawpipe-ai
   ```

---

## 2. Rust — crates.io

**Package:** `clawpipe-ai`
**Source:** `/Users/shaharsolomon/dev/projects/portfolio/clawpipe/rust-sdk`
**`cargo package` dry run:** successful (18 files, 96.3 KiB, 26.9 KiB compressed).
**Tests:** all passing (booster, cache, packer, router, plus doc-test).

Added to `Cargo.toml` during this task:
- `authors = ["ClawPipe Team <info@finsavvyai.com>"]`
- `readme = "README.md"`
- `keywords = ["ai", "llm", "pipeline", "cache", "router"]`
- `categories = ["api-bindings", "caching"]`

### To publish (user action)

1. Create an API token at https://crates.io/settings/tokens
   - Scope: `publish-new` + `publish-update`.
2. Store in `/Users/shaharsolomon/dev/projects/portfolio/clawpipe/.env`:
   ```
   CRATES_IO_TOKEN=cio_...
   ```
3. Run:
   ```bash
   cd /Users/shaharsolomon/dev/projects/portfolio/clawpipe/rust-sdk
   cargo login "$CRATES_IO_TOKEN"
   cargo publish
   ```
4. Verify: https://crates.io/crates/clawpipe-ai
5. Consumer install (in `Cargo.toml`):
   ```toml
   [dependencies]
   clawpipe-ai = "3.0.0"
   ```

---

## 3. Go — Module Proxy

**Module:** `github.com/finsavvyai/clawpipe-go`
**Source:** `/Users/shaharsolomon/dev/projects/portfolio/clawpipe/go-sdk`
**`go mod tidy`:** clean.
**Tests:** `go test ./...` passing (0.353s).

Go modules are discovered automatically by `proxy.golang.org` once a valid
Git tag exists on a public repository. There is no registry push.

### To publish (user action)

1. Push the Go SDK files to a dedicated repo at
   `https://github.com/finsavvyai/clawpipe-go` (or keep it inside the monorepo
   with a subdirectory tag — the below assumes a standalone repo).
2. Create and push the annotated tag:
   ```bash
   cd /Users/shaharsolomon/dev/projects/portfolio/clawpipe/go-sdk
   git tag -a v3.0.0 -m "Go SDK v3.0.0"
   git push origin v3.0.0
   ```
   > If you stay in the monorepo, use a path-prefixed tag:
   > `git tag -a go-sdk/v3.0.0 -m "Go SDK v3.0.0" && git push origin go-sdk/v3.0.0`
   > and publish as `github.com/finsavvyai/clawpipe/go-sdk`.
3. Warm the module proxy:
   ```bash
   GOPROXY=proxy.golang.org go list -m github.com/finsavvyai/clawpipe-go@v3.0.0
   ```
4. Verify: https://pkg.go.dev/github.com/finsavvyai/clawpipe-go
5. Consumer install:
   ```bash
   go get github.com/finsavvyai/clawpipe-go@v3.0.0
   ```

**No tag created during this task** — waiting for user approval per instructions.

---

## 4. Java — Maven Central

**Coordinates:** `ai.clawpipe:clawpipe-sdk:3.0.0`
**Source:** `/Users/shaharsolomon/dev/projects/portfolio/clawpipe/java-sdk`
**`./gradlew build`:** BUILD SUCCESSFUL.

Full publishing setup (Sonatype namespace claim, PGP key generation, gradle
signing plugin, publish task, staging repo release) is documented in
`/Users/shaharsolomon/dev/projects/portfolio/clawpipe/java-sdk/PUBLISHING.md`.

### Short version of what is required

1. Create a Sonatype Central account and claim `ai.clawpipe` namespace (DNS
   TXT record verification against `clawpipe.ai`).
2. Generate and publish a PGP key to a public keyserver.
3. Wire up `maven-publish` + `signing` plugins in `build.gradle.kts` (see
   `PUBLISHING.md` for the exact block).
4. Run `./gradlew publish` with the OSSRH credentials and signing key in the
   environment.
5. Close + release the staging repository at s01.oss.sonatype.org.

---

## README Badges

Paste at the top of `/Users/shaharsolomon/dev/projects/portfolio/clawpipe/README.md`
after publishing succeeds. Each badge will start rendering as soon as its
registry is live.

```markdown
[![npm version](https://img.shields.io/npm/v/clawpipe-ai.svg)](https://www.npmjs.com/package/clawpipe-ai)
[![PyPI version](https://img.shields.io/pypi/v/clawpipe-ai.svg)](https://pypi.org/project/clawpipe-ai/)
[![crates.io](https://img.shields.io/crates/v/clawpipe-ai.svg)](https://crates.io/crates/clawpipe-ai)
[![Go Reference](https://pkg.go.dev/badge/github.com/finsavvyai/clawpipe-go.svg)](https://pkg.go.dev/github.com/finsavvyai/clawpipe-go)
[![Maven Central](https://img.shields.io/maven-central/v/ai.clawpipe/clawpipe-sdk.svg)](https://central.sonatype.com/artifact/ai.clawpipe/clawpipe-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

---

## Install Snippets for Docs / Landing Page

```bash
# Node / TypeScript
npm install clawpipe-ai

# Python
pip install clawpipe-ai

# Rust — add to Cargo.toml
# clawpipe-ai = "3.0.0"

# Go
go get github.com/finsavvyai/clawpipe-go@v3.0.0
```

```xml
<!-- Java / Maven -->
<dependency>
  <groupId>ai.clawpipe</groupId>
  <artifactId>clawpipe-sdk</artifactId>
  <version>3.0.0</version>
</dependency>
```

---

## Task Checklist

- [x] Python: `pytest` (97 passing)
- [x] Python: `python -m build` -> `dist/clawpipe_ai-3.0.0.*`
- [ ] Python: `twine upload` (blocked on `PYPI_TOKEN`)
- [x] Rust: `cargo test` (all passing, incl. doc-test)
- [x] Rust: Cargo.toml metadata complete (name, version, description, license, repo, authors, keywords, categories, readme)
- [x] Rust: `cargo package --allow-dirty` verification successful
- [ ] Rust: `cargo publish` (blocked on `CRATES_IO_TOKEN`)
- [x] Go: `go mod tidy` clean, `go test ./...` passing
- [ ] Go: push `v3.0.0` tag (blocked on user approval)
- [x] Java: `./gradlew build` successful
- [x] Java: `PUBLISHING.md` written with Sonatype + PGP + gradle signing steps
- [ ] Java: Sonatype account + namespace + PGP signing setup
