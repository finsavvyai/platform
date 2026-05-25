#!/usr/bin/env bash
# setup-claw-secrets.sh — Push Claw API keys to all portfolio projects.
# Usage: ./scripts/setup-claw-secrets.sh [--yes]

set -eo pipefail

# shellcheck source=./_cf-env.sh
source "$(dirname "${BASH_SOURCE[0]}")/_cf-env.sh"

PORTFOLIO="/Users/shaharsolomon/dev/projects/portfolio"
CLAW_DIR="${PORTFOLIO}/opensyber/apps/claw-gateway"
CLAW_URL="https://claw.opensyber.cloud"
AUTO="${1:-}"
G='\033[0;32m' C='\033[0;36m' Y='\033[1;33m' N='\033[0m'

confirm() { [[ "$AUTO" == "--yes" ]] && return 0; read -rp "  Proceed? [Y/n] " r; [[ -z "$r" || "$r" =~ ^[Yy] ]]; }

# Project list: id|name|provider|model
PROJECTS="opensyber|OpenSyber|anthropic|claude-sonnet-4-6
tokenforge|TokenForge|anthropic|claude-sonnet-4-6
tenantiq|TenantIQ|anthropic|claude-sonnet-4-6
aegis|Aegis AMLIQ|anthropic|claude-sonnet-4-6
pushci|PushCI|anthropic|claude-haiku-4-5-20251001
sdlc|SDLC Platform|anthropic|claude-sonnet-4-6
lunaos|LunaOS|anthropic|claude-sonnet-4-6"

echo -e "${C}╔══════════════════════════════════════════════════╗${N}"
echo -e "${C}║  Claw Gateway — Portfolio Secret Setup           ║${N}"
echo -e "${C}╚══════════════════════════════════════════════════╝${N}"
echo ""

# ─── Step 1: Generate keys ──────────────────────────────────────────
echo -e "${Y}Step 1: Generating API keys...${N}"
KEYFILE=$(mktemp)
while IFS='|' read -r id name provider model; do
  key="claw_$(openssl rand -hex 32)"
  hash=$(echo -n "$key" | shasum -a 256 | cut -d' ' -f1)
  echo "$id|$name|$provider|$model|$key|$hash" >> "$KEYFILE"
  echo -e "  ${G}✓${N} ${id}: ${key:0:20}..."
done <<< "$PROJECTS"
echo ""

# ─── Helper: write env vars to a file if not present ────────────────
write_env() {
  local file="$1" key="$2" id="$3"
  if grep -q "CLAW_API_KEY" "$file" 2>/dev/null; then
    echo -e "  ${Y}⚠${N} CLAW_API_KEY already in $(basename "$file") — skipping"
    return
  fi
  cat >> "$file" << EOF

# Claw Gateway — self-hosted AI + guard
CLAW_GATEWAY_URL=${CLAW_URL}
CLAW_API_KEY=${key}
CLAW_PROJECT_ID=${id}
EOF
  echo -e "  ${G}✓${N} $(basename "$file") updated"
}

get_key() { grep "^$1|" "$KEYFILE" | cut -d'|' -f5; }
get_hash() { grep "^$1|" "$KEYFILE" | cut -d'|' -f6; }

# ─── Step 2: Cloudflare Worker projects (.dev.vars + wrangler secret)
echo -e "${Y}Step 2: Worker projects (wrangler secret + .dev.vars)...${N}"

for entry in "opensyber|opensyber/apps/api" "tokenforge|opensyber/apps/tokenforge-api" \
             "tenantiq|tenantiq/apps/api" "pushci|push-ci.dev/api"; do
  id="${entry%%|*}"
  rel="${entry#*|}"
  path="${PORTFOLIO}/${rel}"
  key=$(get_key "$id")

  [[ ! -d "$path" ]] && echo -e "  ${Y}⚠${N} $id: not found" && continue
  echo -e "  ${C}→${N} $id ($rel)"
  if confirm; then
    cd "$path"
    echo "$key" | wrangler secret put CLAW_API_KEY 2>/dev/null || true
    echo "$CLAW_URL" | wrangler secret put CLAW_GATEWAY_URL 2>/dev/null || true
    write_env ".dev.vars" "$key" "$id"
  fi
done
echo ""

# ─── Step 3: Standalone projects (.env) ─────────────────────────────
echo -e "${Y}Step 3: Standalone projects (.env)...${N}"

for entry in "aegis|aegis" "sdlc|sdlc-platform" "lunaos|luna-os" "pushci|push-ci.dev"; do
  id="${entry%%|*}"
  rel="${entry#*|}"
  path="${PORTFOLIO}/${rel}"
  key=$(get_key "$id")

  [[ ! -d "$path" ]] && echo -e "  ${Y}⚠${N} $id: not found" && continue
  echo -e "  ${C}→${N} $id ($rel/.env)"
  if confirm; then
    write_env "$path/.env" "$key" "$id"
  fi
done
echo ""

# ─── Step 4: Claw Gateway Ollama config ─────────────────────────────
echo -e "${Y}Step 4: Claw Gateway Ollama config...${N}"
if ! grep -q "OLLAMA_URL" "${CLAW_DIR}/.dev.vars" 2>/dev/null; then
  echo -e "\n# Self-hosted Ollama for /v1/guard\nOLLAMA_URL=http://127.0.0.1:11434" >> "${CLAW_DIR}/.dev.vars"
  echo -e "  ${G}✓${N} Ollama URL set"
else
  echo -e "  ${Y}⚠${N} Already configured"
fi
echo ""

# ─── Step 5: Register in Claw Gateway KV ───────────────────────────
echo -e "${Y}Step 5: Registering in Claw Gateway KV...${N}"
cd "$CLAW_DIR"

while IFS='|' read -r id name provider model key hash; do
  config="{\"projectId\":\"$id\",\"name\":\"$name\",\"apiKeyHash\":\"$hash\",\"defaultProvider\":\"$provider\",\"defaultModel\":\"$model\",\"maxTokensPerRequest\":8192,\"rateLimitPerMinute\":100,\"enabled\":true}"
  echo -e "  ${C}→${N} $id ($name)"
  wrangler kv key put --binding PROJECT_KEYS "project:$id" "$config" 2>/dev/null \
    && echo -e "    ${G}✓${N} local" || echo -e "    ${Y}⚠${N} local failed"
  wrangler kv key put --binding PROJECT_KEYS --remote "project:$id" "$config" 2>/dev/null \
    && echo -e "    ${G}✓${N} remote" || echo -e "    ${Y}⚠${N} remote failed"
done < "$KEYFILE"
echo ""

# ─── Summary ────────────────────────────────────────────────────────
echo -e "${C}╔══════════════════════════════════════════════════╗${N}"
echo -e "${C}║  Setup Complete                                  ║${N}"
echo -e "${C}╚══════════════════════════════════════════════════╝${N}"
echo ""
echo -e "${G}API Keys (save these — cannot be recovered):${N}"
echo ""
while IFS='|' read -r id name _ _ key _; do
  printf "  %-14s %s\n" "$name:" "$key"
done < "$KEYFILE"
rm -f "$KEYFILE"
echo ""
echo -e "${Y}Next steps:${N}"
echo "  1. Deploy:  cd apps/claw-gateway && pnpm deploy"
echo "  2. Model:   ollama pull superagent-guard-1.7b-Q8_0"
echo "  3. Test:    curl ${CLAW_URL}/v1/guard -H 'Authorization: Bearer <key>' -d '{\"input\":\"test\"}'"
