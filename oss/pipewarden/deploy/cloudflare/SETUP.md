# Cloudflare Deployment — PipeWarden

Two services, two Cloudflare products:

| Service | Cloudflare Product | Domain |
|---------|-------------------|--------|
| Marketing site (`website/`) | Cloudflare Pages | `pipewarden.io` |
| Go API server | Cloudflare Tunnel | `app.pipewarden.io` |

---

## 1. Marketing Site (Cloudflare Pages)

```bash
# Install wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler pages deploy website/ --project-name pipewarden-website
```

Then in Cloudflare Pages dashboard:
- Add custom domain: `pipewarden.io`
- Pages will auto-provision SSL

---

## 2. API Server (Cloudflare Tunnel)

### One-time setup

```bash
# Install cloudflared
brew install cloudflared   # macOS
# or: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create pipewarden
# → prints Tunnel ID, saves credentials to ~/.cloudflared/<id>.json

# Route DNS
cloudflared tunnel route dns pipewarden app.pipewarden.io

# Get token for Docker Compose
cloudflared tunnel token <tunnel-id>
# → copy this value into CLOUDFLARE_TUNNEL_TOKEN in deploy/.env
```

### Update tunnel.yml

Edit `deploy/cloudflare/tunnel.yml`:
- Replace `<YOUR_TUNNEL_ID>` with the tunnel ID from above (two places)

### Start stack

```bash
cd deploy/
cp .env.example .env   # fill in all values
docker compose up -d
```

The `cloudflared` container reads `CLOUDFLARE_TUNNEL_TOKEN` and connects to `pipewarden:8080` internally — no public port needed.

---

## 3. Database

PipeWarden needs a Postgres database. Recommended options:

| Provider | Free tier | SSL |
|----------|-----------|-----|
| [Neon](https://neon.tech) | 0.5 GB | ✅ |
| [Supabase](https://supabase.com) | 500 MB | ✅ |

Set `PIPEWARDEN_DATABASE_URL` in `deploy/.env`:
```
PIPEWARDEN_DATABASE_URL=postgres://user:pass@ep-xyz.us-east-2.aws.neon.tech/pipewarden?sslmode=require
```

---

## 4. Environment Variables

See `deploy/.env.example` for the full list. Required at minimum:

```
PIPEWARDEN_DATABASE_URL=...
PIPEWARDEN_VAULT_KEY=...        # 32 random bytes, base64: openssl rand -base64 32
CLAUDE_API_KEY=...
CLOUDFLARE_TUNNEL_TOKEN=...
```

---

## 5. Verify

```bash
# Health check via tunnel
curl https://app.pipewarden.io/health

# Marketing site
curl -I https://pipewarden.io
```
