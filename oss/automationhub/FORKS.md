# Vendored Forks

OpenClaw and OpenHands are included as **git submodules** for deep integration and full control.

## Submodules

| Fork | Path | Upstream |
|------|------|----------|
| **OpenHands** (software-agent-sdk) | `vendor/openhands` | https://github.com/OpenHands/software-agent-sdk |
| **OpenClaw** | `openclaw` | https://github.com/openclaw/openclaw |

## Cloning

```bash
git clone --recurse-submodules <repo-url>
# or, if already cloned:
git submodule update --init --recursive
```

## OpenHands (vendor/openhands)

- **Usage:** Backend uses it for the DevelopmentAgent (embedded SDK).
- **Path:** `backend/app/integrations/openhands_embedded.py` adds the vendored packages to `sys.path`.
- **Install (from project root, requires Python ≥3.12):**
  ```bash
  pip install -e vendor/openhands/openhands-sdk -e vendor/openhands/openhands-tools
  ```
  This installs the fork in editable mode and pulls its dependencies (litellm, etc.).
- **Update from upstream:**
  ```bash
  cd vendor/openhands && git fetch origin && git checkout main && git pull
  cd ../.. && git add vendor/openhands && git commit -m "chore: update openhands fork"
  ```

## OpenClaw (openclaw/)

- **Usage:** Docker builds the gateway from `./openclaw` (see `docker-compose.yml`).
- **Update from upstream:**
  ```bash
  cd openclaw && git fetch origin && git checkout main && git pull
  cd .. && git add openclaw && git commit -m "chore: update openclaw fork"
  ```

## Benefits of Forking

- **Tighter integration:** Modify OpenHands to use our `UPMAgent` base; modify OpenClaw to use our backend as the brain.
- **Single codebase:** One repo, one CI, one release.
- **Custom features:** Tenant isolation, RBAC, audit logging inside the forks.
- **No external drift:** We control when to pull upstream changes.

## License

Both projects are MIT-licensed. See `vendor/openhands/LICENSE` and `openclaw/LICENSE`.
