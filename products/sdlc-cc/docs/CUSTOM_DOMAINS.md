# Custom domains under sdlc.cc — operator runbook

> **Blocker note (2026-05-11):** the Cloudflare token in `.env`
> has Pages + Zone-list scope but **not DNS-write**. The Pages
> "Add custom domain" API needs the DNS-write capability to insert
> the CNAME automatically. Until a token with broader scope is
> available, the steps below must run via the Cloudflare dashboard
> or with a re-scoped token.

## Targets

Six deployed Pages projects → six subdomains:

| Pages project | Today's URL | Target |
|---|---|---|
| `sdlc-cc-landing`  | `sdlc-cc-landing.pages.dev`  | **`sdlc.cc`** (apex) |
| `sdlc-cc-scrub`    | `sdlc-cc-scrub.pages.dev`    | **`scrub.sdlc.cc`** |
| `sdlc-cc-outlook`  | `sdlc-cc-outlook.pages.dev`  | **`addin.sdlc.cc`** |
| `sdlc-cc-excel`    | `sdlc-cc-excel.pages.dev`    | **`addin-excel.sdlc.cc`** |
| `sdlc-cc-word`     | `sdlc-cc-word.pages.dev`     | **`addin-word.sdlc.cc`** |
| `sdlc-cc-teams`    | `sdlc-cc-teams.pages.dev`    | **`addin-teams.sdlc.cc`** |

Plus the gateway (separate path — see `CUSTOM_DOMAINS.md` "API" section below):

| Service | Target |
|---|---|
| sdlc.cc gateway (sdlc-api binary) | **`api.sdlc.cc`** |

## Two ways to do it

### Option A — Cloudflare dashboard (5 min, no token changes)

For each of the six Pages projects:

1. https://dash.cloudflare.com → **Workers & Pages** → click the project (e.g. `sdlc-cc-scrub`)
2. **Custom domains** → **Set up a custom domain**
3. Enter the target hostname (e.g. `scrub.sdlc.cc`)
4. Cloudflare auto-creates the CNAME in the `sdlc.cc` zone (proxied — orange cloud)
5. Wait ~30s for cert provisioning; the green "Active" badge confirms it

For the apex (`sdlc.cc` → `sdlc-cc-landing`), Cloudflare uses a flattening trick on the apex CNAME; same flow.

Repeat six times. ~5 minutes total.

### Option B — automate via API (one new token, then a script)

Mint a new Cloudflare API token with these permissions:

- **Account → Cloudflare Pages → Edit**
- **Zone → DNS → Edit** (for `sdlc.cc` only)

Then:

```bash
export CF_TOKEN=...   # the new token
ZONE_ID=4d9d9ecbfde89532d9e6a6a9354d1af5   # sdlc.cc

# For each (project, hostname) pair:
for pair in \
  "sdlc-cc-scrub    scrub.sdlc.cc" \
  "sdlc-cc-outlook  addin.sdlc.cc" \
  "sdlc-cc-excel    addin-excel.sdlc.cc" \
  "sdlc-cc-word     addin-word.sdlc.cc" \
  "sdlc-cc-teams    addin-teams.sdlc.cc"
do
  read proj host <<<"$pair"

  # 1. Add CNAME (proxied)
  curl -sS -H "Authorization: Bearer $CF_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -d "{\"type\":\"CNAME\",\"name\":\"$host\",\"content\":\"$proj.pages.dev\",\"proxied\":true}"

  # 2. Bind hostname to Pages project
  curl -sS -H "Authorization: Bearer $CF_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$proj/domains" \
    -d "{\"name\":\"$host\"}"

  echo "$proj → $host"
done

# Apex (sdlc.cc → sdlc-cc-landing) — CF dashboard handles the flatten
# trick. The API call is the same shape; type=CNAME, name="@" or
# bare zone name, target sdlc-cc-landing.pages.dev. Verify in dash.
```

## Verification

After either option:

```bash
for h in scrub addin addin-excel addin-word addin-teams sdlc; do
  fqdn=$h.sdlc.cc
  [[ $h == sdlc ]] && fqdn=sdlc.cc
  printf "%-22s " "$fqdn"
  curl -sSI "https://$fqdn" | head -1
done
```

Each should return `HTTP/2 200` (or 308 redirect to the trailing-slash variant) within ~30 seconds of cert issuance.

## Gateway: `api.sdlc.cc`

The gateway (sdlc-api) is a Go binary, not a Pages site. Two paths:

1. **Cloudflare Tunnel** (your laptop, free) — see `LAUNCHD_TUNNEL.md`.
2. **Fly.io** — see `scripts/fly-bootstrap.sh`. Add the custom domain via `flyctl certs add api.sdlc.cc --app sdlc-cc` and CNAME `api` to `<app>.fly.dev` in Cloudflare.

Today's existing `api.sdlc.cc` Worker (`sdlc-proxy v1.1.0`) needs replacing — either route `/v1/*` through the Worker to the new origin, or unmount the Worker route and let DNS point directly at the new origin.
