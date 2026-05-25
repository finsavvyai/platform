# Using UPM.Plus / AutomationHub Across Your Projects

Use the same gateway, APIs, and deploy pattern from **any project** (other repos, apps, or scripts).

---

## 1. Call the deployed gateway from any project

Treat the deployed worker as a **shared service**. In each project, set the base URL and call health or API routes.

### Environment variables (per project)

```bash
# Development
UPM_PLUS_BASE_URL=https://upmplus.dev
# or Production
UPM_PLUS_BASE_URL=https://upm.plus

# Optional: API key if your worker requires it
UPM_PLUS_API_KEY=your-api-key
```

### Example: health check from Node

```javascript
const base = process.env.UPM_PLUS_BASE_URL || 'https://upmplus.dev';
const res = await fetch(`${base}/api/health`);
const health = await res.json();
console.log(health.status); // healthy | degraded | unhealthy
```

### Example: from curl / shell

```bash
export UPM_PLUS_BASE_URL=https://upmplus.dev
curl -s "$UPM_PLUS_BASE_URL/health"
curl -s "$UPM_PLUS_BASE_URL/api/health"
```

### Example: from Python

```python
import os
import requests

BASE = os.environ.get("UPM_PLUS_BASE_URL", "https://upmplus.dev")
r = requests.get(f"{BASE}/api/health")
print(r.json().get("status"))
```

---

## 2. Reuse the deploy pattern in another repo

Use the same **wrangler + script** pattern in other Cloudflare Worker projects.

### Option A: Copy the scripts

From this repo, copy into your other project:

- `scripts/wrangler-deploy.sh` — multi-env deploy
- `scripts/test-cloudflare-production.sh` — smoke test
- `scripts/verify-production-ready.sh` — pre-deploy checks (optional)

Then add a `wrangler.toml` in the other repo (one worker per project or per env). You can point `main` to your worker entry (e.g. `src/worker.js`).

### Option B: Run deploy from this repo for multiple “projects”

Keep one AutomationHub repo and deploy **different workers** by switching entry or env:

- Duplicate an env in `wrangler.toml` (e.g. `[env.project-x]`) with that project’s routes and bindings.
- Deploy: `./scripts/wrangler-deploy.sh --env project-x`

Same scripts, multiple workers/envs from one place.

### Option C: This repo as a git submodule

In another repo:

```bash
git submodule add <automationhub-repo-url> automationhub
cd automationhub
./scripts/wrangler-deploy.sh --env development
```

That repo can also call the deployed URLs via `UPM_PLUS_BASE_URL` as in section 1.

---

## 3. Central place for base URLs

| Environment | Base URL              | Use for           |
|-------------|-----------------------|-------------------|
| Development | `https://upmplus.dev` | Dev and testing   |
| Production  | `https://upm.plus`     | Live traffic      |
| Staging     | `https://upmplus.io`   | Pre-prod          |

Use one of these as `UPM_PLUS_BASE_URL` in each project’s env (e.g. `.env`, CI, or host config).

---

## 4. Quick reference

- **Deploy this gateway:** [DEPLOY_NOW.md](DEPLOY_NOW.md)
- **Production status:** [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md)
- **Health:** `GET {UPM_PLUS_BASE_URL}/health` or `GET {UPM_PLUS_BASE_URL}/api/health`
