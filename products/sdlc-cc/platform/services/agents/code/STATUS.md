# @sdlc/agent-code — STATUS

REAL — needs Docker at runtime + GitHub App credentials at deploy.
Tests run without either via injected exec/fetch seams.

## Implemented

### `apply_patch`
- Spawns `docker run --rm -v <workdir>:/work -w /work
  --security-opt no-new-privileges alpine:3 sh -c "git init -q; git apply -v /work/.patch"`.
- Returns `{ exitCode, filesChanged, stdout, stderr }`.
- Constructor accepts an injectable `exec` for tests; production uses
  `child_process.execFile`.

### `run_tests`
- Spawns `docker run --rm -v <workdir>:/work -w /work
  --security-opt no-new-privileges node:22-alpine sh -c "<cmd>"`.
- Default test command: `npm test`. Override via `testCommand` in
  constructor or `defaultCommand` per call.
- Returns `{ exitCode, stdout, stderr, durationMs }`.

### `open_pr`
- Mints an RS256 JWT with the GitHub App private key (PEM at
  `privateKeyPath` or inline via `privateKeyPem`).
- Exchanges for an installation access token via
  `POST /app/installations/{id}/access_tokens`.
- Creates the PR via `POST /repos/{owner}/{repo}/pulls` with
  `Authorization: token <inst>`.
- Returns `{ url, number }`.
- Tests inject a mock `fetch` and use a deterministic test private key
  at `src/test-fixtures/test-private-key.pem`.

## Runtime requirements
- Docker (or compatible OCI runtime) on the host for apply_patch and
  run_tests. Without Docker, both fail at the exec boundary with the
  exact error returned by `docker` (exit 127 / "command not found").
- A GitHub App with installation on the target repo, plus access to
  the App's private key + installation ID for `open_pr`.

## Tests
- `node --test src/*.test.js src/tools/*.test.js`.
- All four tools have >=4 tests each, all using injected seams so the
  suite is hermetic.
