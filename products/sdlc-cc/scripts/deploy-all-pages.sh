#!/usr/bin/env bash
# deploy-all-pages.sh — one-shot redeploy of every Cloudflare Pages
# project in this repo. Idempotent: re-running publishes a fresh
# deployment to the same project; URL stays stable.
#
# Reads CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID from
# ../sdlc-platform/.env (the layout dev-up.sh assumes).
#
# Skips any project whose source directory is missing — useful when
# new surfaces are added (just add a row to PROJECTS below; the
# script picks it up automatically).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDLC_CC="$(cd "$SCRIPT_DIR/.." && pwd)"
PORTFOLIO="$(cd "$SDLC_CC/.." && pwd)"

# (project name, source directory relative to SDLC_CC)
PROJECTS=(
  "sdlc-cc-landing     landing"
  "sdlc-cc-scrub       web"
  "sdlc-cc-outlook     outlook-addin/web"
  "sdlc-cc-excel       excel-addin/web"
  "sdlc-cc-word        word-addin/web"
  "sdlc-cc-ppt         powerpoint-addin/web"
  "sdlc-cc-teams       teams-app/web"
)

if [[ -t 1 ]]; then
  BOLD=$'\e[1m'; GRN=$'\e[32m'; YEL=$'\e[33m'; RED=$'\e[31m'; RST=$'\e[0m'
else BOLD=; GRN=; YEL=; RED=; RST=; fi

env_file="$PORTFOLIO/sdlc-platform/.env"
[[ -f "$env_file" ]] || { echo "${RED}missing $env_file${RST}"; exit 1; }
set -a; source "$env_file"; set +a

command -v wrangler >/dev/null || { echo "${RED}wrangler not installed (npm i -g wrangler)${RST}"; exit 1; }
[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || { echo "${RED}CLOUDFLARE_API_TOKEN not set in .env${RST}"; exit 1; }

deployed=0; skipped=0; failed=0
for entry in "${PROJECTS[@]}"; do
  read -r project src <<<"$entry"
  src_full="$SDLC_CC/$src"

  if [[ ! -d "$src_full" ]]; then
    printf "${YEL}  ⚠ skip${RST} %-22s (missing dir %s)\n" "$project" "$src"
    skipped=$((skipped+1))
    continue
  fi

  printf "${BOLD}▸ deploying${RST} %-22s ← %s\n" "$project" "$src"
  if wrangler pages deploy "$src_full" \
       --project-name="$project" \
       --branch=main \
       --commit-dirty=true 2>&1 | tail -3; then
    deployed=$((deployed+1))
  else
    printf "${RED}  ✗ failed${RST}\n"
    failed=$((failed+1))
  fi
done

printf "\n${BOLD}Done.${RST} deployed=%d skipped=%d failed=%d\n" \
  "$deployed" "$skipped" "$failed"
exit $failed
