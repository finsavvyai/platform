# sdlc.cc — go-live checklist

> What "demoable today" → "production-grade" requires. Sorted by
> effort/impact, not topic. Each item lists what unblocks if you
> finish it.

## Status snapshot (2026-05-11)

**Code complete + deployed**: 7 static surfaces on Cloudflare Pages,
2 browser extensions sideload-ready, 1 CF Worker plugin code-complete,
1 Go gateway running locally with full DLP + audit + quota + metrics.

**Outstanding**: every item below is **credential / account / DNS
work that only you can do**. None require new code.

---

## Cloudflare (5 minutes)

### 1. Custom domains — **Pages bindings done, 5 DNS records pending**

✅ **Already done (Pages-side bindings):** all 8 custom-domain
bindings were added to their Pages projects via the API. `sdlc.cc`
and `www.sdlc.cc` resolve now (apex DNS pre-existed).

⚠ **Pending — 2 min in dashboard:** the 5 subdomain CNAMEs.

Cloudflare → DNS → `sdlc.cc` zone → **Add record** ×5:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | scrub | `sdlc-cc-scrub.pages.dev` | proxied |
| CNAME | addin | `sdlc-cc-outlook.pages.dev` | proxied |
| CNAME | addin-excel | `sdlc-cc-excel.pages.dev` | proxied |
| CNAME | addin-word | `sdlc-cc-word.pages.dev` | proxied |
| CNAME | addin-ppt | `sdlc-cc-ppt.pages.dev` | proxied |
| CNAME | addin-teams | `sdlc-cc-teams.pages.dev` | proxied |

Or mint a CF token with `Zone:DNS:Edit` for `sdlc.cc` and run:

```bash
CF_DNS_TOKEN=...
ZONE_ID=4d9d9ecbfde89532d9e6a6a9354d1af5
for pair in "scrub sdlc-cc-scrub" "addin sdlc-cc-outlook" \
            "addin-excel sdlc-cc-excel" "addin-word sdlc-cc-word" \
            "addin-ppt sdlc-cc-ppt" "addin-teams sdlc-cc-teams"; do
  read sub proj <<<"$pair"
  curl -sS -X POST -H "Authorization: Bearer $CF_DNS_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -d "{\"type\":\"CNAME\",\"name\":\"$sub\",\"content\":\"$proj.pages.dev\",\"proxied\":true}"
done
```

~30s per cert after the CNAME exists; Pages bindings will flip from "initializing" to "active".

### 2. Public gateway at `api.sdlc.cc`

One of:

**Option A — Cloudflare Tunnel** (free, laptop, ~10 min)
```bash
cloudflared tunnel login          # one-time browser auth
./scripts/tunnel-up.sh            # creates tunnel + DNS + runs
```
Make it boot-persistent: copy the plist from `docs/LAUNCHD_TUNNEL.md`
into `~/Library/LaunchAgents/`.

**Option B — Fly.io** (cloud, $0–5/mo, ~30 min)
```bash
flyctl auth login
./scripts/fly-bootstrap.sh        # app + Postgres + secrets + deploy
flyctl certs add api.sdlc.cc --app sdlc-cc
# Cloudflare: CNAME api → <app>.fly.dev
```

**Unblocks**: every surface stops depending on `localhost:8080`; you can demo from anywhere.

> The existing `api.sdlc.cc` Worker (`sdlc-proxy v1.1.0`) will conflict on hostname. Unmount its route in CF dash first, OR use `api2.sdlc.cc` (set `HOSTNAME=api2.sdlc.cc` before invoking the tunnel script).

---

## GitHub (5 minutes)

### 3. `SDLC_CORE_TOKEN` repo secret

1. https://github.com/settings/personal-access-tokens/new
   - Resource owner: `finsavvyai`
   - Repository access: only `finsavvyai/sdlc-core`
   - Permissions → Contents: **Read-only**
2. `gh secret set SDLC_CORE_TOKEN --repo finsavvyai/sdlc-cc`

**Unblocks**:
- `test.yml` workflow — runs every push (currently failing on missing token)
- `publish-image` workflow — pushes container to `ghcr.io/finsavvyai/sdlc-cc:main` on every main push

### 4. (Optional) Trigger initial image publish
```bash
gh workflow run publish-image --repo finsavvyai/sdlc-cc
```

---

## Cloudflare AI Gateway plugin (10 minutes)

```bash
cd cf-ai-gateway-worker
npm install
wrangler login                              # if not already
wrangler secret put SDLC_API_KEY            # paste a sk_sdlc_*
wrangler secret put CF_AI_GATEWAY_URL       # https://gateway.ai.cloudflare.com/v1/<acct>/<gw>
wrangler deploy
```

Output: `https://sdlc-cc-cf-gw.<your>.workers.dev` — drop-in
replacement for the AI Gateway URL.

**Unblocks**: customers already on Cloudflare AI Gateway can adopt sdlc.cc DLP by swapping one URL.

---

## Store listings (separate accounts; expect days, not minutes)

### 5. Chrome Web Store ($5 one-time)

1. https://chrome.google.com/webstore/devconsole (sign-in fee)
2. Zip `extension/` → upload
3. Replace placeholder 1×1 PNG icons with branded 128×128 + 440×280 promo tile (design needed)
4. Privacy policy URL + permissions justification
5. Review: ~3–7 days

### 6. Edge Add-ons (free)

Same MV3 manifest as Chrome. https://partner.microsoft.com/en-us/dashboard/microsoftedge — Microsoft Partner Center → Microsoft Edge program.

### 7. Firefox AMO (free)

```bash
cd extension-firefox
npx web-ext lint
npx web-ext sign --api-key=... --api-secret=...
# OR upload at https://addons.mozilla.org/developers/
```

### 8. Microsoft AppSource for Office add-ins ($99/yr verified org)

1. https://partner.microsoft.com/en-us/dashboard (Partner Center)
2. Submit publisher verification — needs business documents
3. Replace placeholder GUIDs in each `manifest.xml`:
   - `outlook-addin/manifest.xml`
   - `excel-addin/manifest.xml`
   - `word-addin/manifest.xml`
   - `powerpoint-addin/manifest.xml`
4. Replace placeholder icons (all PNG sizes)
5. Submit each as a separate AppSource offer
6. Review per offer: ~10–20 days

### 9. Microsoft Teams Store (same Partner Center)

1. Replace bot ID placeholder (`00000000-...`) in `teams-app/manifest/manifest.json`
2. Register an Azure Bot resource if you want the compose-extension action (current scaffold is tab-only)
3. Submit zip to Teams Store

---

## Designer-side polish

### 10. Branded icons + screenshots

Currently every surface ships 1×1 single-colour placeholders so manifests validate. For listings you need:

| Where | Sizes needed | Notes |
|---|---|---|
| Browser ext (Chrome/Edge/Firefox) | 16, 32, 48, 128 | + 440×280 + 920×680 + 1400×560 promo tiles |
| Office add-ins (Outlook/Excel/Word/PPT) | 16, 32, 64, 80, 128 | brand-coloured per app (Excel green, Word blue, etc. helps blend with ribbon) |
| Teams | 192×192 colour + 32×32 outline transparent | strict transparency rules |
| Landing page | OG image 1200×630 | for social previews |

---

## Sales / partnerships

### 11. Two design-partner MSPs

The competitive landscape doc (`docs/COMPETITIVE_LANDSCAPE.md`)
recommends MSP channel as the defensible angle. Without 2 pilot MSPs
the pricing + positioning stays speculative.

---

## Verification

After items 1 + 2 are done, this should all return 200:

```bash
for url in \
  https://sdlc.cc \
  https://scrub.sdlc.cc \
  https://addin.sdlc.cc \
  https://addin-excel.sdlc.cc \
  https://addin-word.sdlc.cc \
  https://addin-ppt.sdlc.cc \
  https://addin-teams.sdlc.cc \
  https://api.sdlc.cc/health
do
  printf "%-30s " "$url"
  curl -sSI "$url" | head -1
done
```

---

## Estimated time to "everything in this list"

- Items 1–4 (operator, fast): **~30 min**
- Items 5–9 (store listings + reviews): **~5–10 calendar days**
- Items 10–11 (design + sales): **separate workstream, weeks**

Items 1–4 are sufficient for live demos to prospects. Item 11 unlocks pricing reality. The rest is polish + scale.
