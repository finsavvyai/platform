#!/usr/bin/env bash
# ============================================================
#  Qestro — AI-Powered QA Platform
#  Modern Launch Script with Voice & Graphical UI
#
#  Usage:
#    ./start.sh              # default: local development
#    ./start.sh dev          # local development (same as default)
#    ./start.sh staging      # staging environment
#    ./start.sh production   # production environment
# ============================================================
set -e

# ── Resolve project root ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Environment Configuration ────────────────────────────────
ENV="${1:-dev}"

case "$ENV" in
  dev|development)
    ENV_LABEL="DEVELOPMENT"
    ENV_COLOR="\033[1;32m"   # green
    BACKEND_PORT=8787
    FRONTEND_PORT=3000
    NODE_ENV=development
    API_URL="http://localhost:8787"
    FRONTEND_URL="http://localhost:3000"
    ;;
  staging)
    ENV_LABEL="STAGING"
    ENV_COLOR="\033[1;33m"   # yellow
    BACKEND_PORT="${BACKEND_PORT:-8787}"
    FRONTEND_PORT="${FRONTEND_PORT:-3000}"
    NODE_ENV=staging
    API_URL="${API_URL:-https://staging-api.qestro.app}"
    FRONTEND_URL="${FRONTEND_URL:-https://staging.qestro.app}"
    ;;
  prod|production)
    ENV_LABEL="PRODUCTION"
    ENV_COLOR="\033[1;31m"   # red
    BACKEND_PORT="${BACKEND_PORT:-8787}"
    FRONTEND_PORT="${FRONTEND_PORT:-3000}"
    NODE_ENV=production
    API_URL="${API_URL:-https://api.qestro.app}"
    FRONTEND_URL="${FRONTEND_URL:-https://qestro.app}"
    ;;
  *)
    echo "Unknown environment: $ENV"
    echo "Usage: ./start.sh [dev|staging|production]"
    exit 1
    ;;
esac

export NODE_ENV
export PORT="$BACKEND_PORT"
export API_URL
export FRONTEND_URL
export CORS_ORIGIN="$FRONTEND_URL,http://localhost:3000,http://localhost:5173"

# ── Colors & Symbols ────────────────────────────────────────
R='\033[0m'       # Reset
B='\033[1m'       # Bold
DIM='\033[2m'     # Dim
UL='\033[4m'      # Underline
RED='\033[1;31m'
GRN='\033[1;32m'
YLW='\033[1;33m'
BLU='\033[1;34m'
MAG='\033[1;35m'
CYN='\033[1;36m'
WHT='\033[1;37m'
GRAY='\033[0;90m'
BG_BLU='\033[44m'
BG_MAG='\033[45m'
BG_GRN='\033[42m'
BG_RED='\033[41m'

OK="${GRN}✓${R}"
FAIL="${RED}✗${R}"
ARROW="${CYN}▶${R}"
DOT="${MAG}●${R}"
SPARK="${YLW}⚡${R}"

# ── Voice (macOS only, non-blocking) ────────────────────────
speak() {
  if command -v say &>/dev/null; then
    say -v Samantha -r 200 "$1" &
  fi
}

# ── Helpers ──────────────────────────────────────────────────
spinner() {
  local pid=$1 msg=$2
  local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  local i=0
  tput civis 2>/dev/null  # hide cursor
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${CYN}${frames[$i]}${R}  ${msg}"
    i=$(( (i + 1) % ${#frames[@]} ))
    sleep 0.08
  done
  tput cnorm 2>/dev/null  # show cursor
  printf "\r"
}

progress_bar() {
  local current=$1 total=$2 width=40 label=$3
  local pct=$(( current * 100 / total ))
  local filled=$(( current * width / total ))
  local empty=$(( width - filled ))
  local bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=0; i<empty; i++)); do bar+="░"; done
  printf "\r  ${MAG}%s${R} ${DIM}%3d%%${R}  ${GRAY}%s${R}" "$bar" "$pct" "$label"
}

check_port() {
  lsof -ti:"$1" &>/dev/null
}

kill_port() {
  lsof -ti:"$1" 2>/dev/null | xargs kill -9 2>/dev/null || true
}

wait_for_port() {
  local port=$1 timeout=$2 elapsed=0
  while ! curl -s "http://localhost:$port/health" &>/dev/null; do
    sleep 0.5
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$((timeout * 2))" ]; then
      return 1
    fi
  done
  return 0
}

section() {
  echo ""
  echo -e "  ${BG_BLU}${WHT}${B}  $1  ${R}"
  echo ""
}

# ── Trap for clean shutdown ──────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo ""
  echo -e "  ${YLW}Shutting down Qestro...${R}"
  speak "Shutting down Questro. Goodbye."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  kill_port $BACKEND_PORT
  kill_port $FRONTEND_PORT
  echo -e "  ${OK}  Servers stopped. See you next time!"
  echo ""
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Clear & Banner ───────────────────────────────────────────
clear
echo ""
echo -e "${MAG}"
cat << 'LOGO'
       ██████╗ ███████╗███████╗████████╗██████╗  ██████╗
      ██╔═══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗
      ██║   ██║█████╗  ███████╗   ██║   ██████╔╝██║   ██║
      ██║▄▄ ██║██╔══╝  ╚════██║   ██║   ██╔══██╗██║   ██║
      ╚██████╔╝███████╗███████║   ██║   ██║  ██║╚██████╔╝
       ╚══▀▀═╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝
LOGO
echo -e "${R}"
echo -e "      ${DIM}AI-Powered QA Platform  •  v1.0.0  •  $(date '+%B %d, %Y')${R}"
echo -e "      ${ENV_COLOR}${B}◆ ${ENV_LABEL}${R}${DIM}  •  Backend :${BACKEND_PORT}  •  Frontend :${FRONTEND_PORT}${R}"
echo -e "      ${DIM}────────────────────────────────────────────────${R}"
echo ""

speak "Welcome to Questro. Initializing launch sequence."

# ── Phase 1: Environment Check ───────────────────────────────
section "PHASE 1 — ENVIRONMENT CHECK"

CHECKS=0
TOTAL_CHECKS=4

# Node.js
CHECKS=$((CHECKS+1))
progress_bar $CHECKS $TOTAL_CHECKS "Checking Node.js..."
sleep 0.3
NODE_V=$(node --version 2>/dev/null || echo "missing")
if [[ "$NODE_V" == "missing" ]]; then
  echo -e "\r  ${FAIL}  Node.js — ${RED}not found${R}. Install from https://nodejs.org"
  exit 1
fi
echo -e "\r  ${OK}  Node.js          ${GRN}$NODE_V${R}                         "

# npm
CHECKS=$((CHECKS+1))
progress_bar $CHECKS $TOTAL_CHECKS "Checking npm..."
sleep 0.2
NPM_V=$(npm --version 2>/dev/null || echo "missing")
echo -e "\r  ${OK}  npm              ${GRN}v$NPM_V${R}                         "

# TypeScript
CHECKS=$((CHECKS+1))
progress_bar $CHECKS $TOTAL_CHECKS "Checking TypeScript..."
sleep 0.2
TSC_V=$(npx tsc --version 2>/dev/null || echo "missing")
echo -e "\r  ${OK}  TypeScript       ${GRN}$TSC_V${R}                    "

# Ports
CHECKS=$((CHECKS+1))
progress_bar $CHECKS $TOTAL_CHECKS "Checking ports..."
sleep 0.2
PORT_OK=true
if check_port $BACKEND_PORT; then
  echo -e "\r  ${DOT}  Port $BACKEND_PORT        ${YLW}in use — will reclaim${R}                "
  kill_port $BACKEND_PORT
  sleep 0.5
else
  echo -e "\r  ${OK}  Port $BACKEND_PORT        ${GRN}available${R}                         "
fi
if check_port $FRONTEND_PORT; then
  echo -e "  ${DOT}  Port $FRONTEND_PORT        ${YLW}in use — will reclaim${R}"
  kill_port $FRONTEND_PORT
  sleep 0.5
else
  echo -e "  ${OK}  Port $FRONTEND_PORT        ${GRN}available${R}"
fi

speak "Environment checks passed."

# ── Phase 1.5: Database Setup (Production/Staging only) ─────────
if [ "$ENV" != "dev" ] && [ "$ENV" != "development" ]; then
  section "PHASE 1.5 — DATABASE SETUP"

  # Only run database setup if DATABASE_URL is set
  if [ -n "$DATABASE_URL" ]; then
    bash scripts/setup-db.sh
  else
    echo -e "  ${YLW}Skipping database setup (DATABASE_URL not set)${R}"
  fi
fi

# ── Phase 2: Compile Backend ─────────────────────────────────
section "PHASE 2 — COMPILE BACKEND"

echo -e "  ${ARROW}  Compiling TypeScript..."

# Check if pre-compiled dist exists; if not, compile with tsc
if [ -f "backend/dist-compiled/index.minimal.js" ]; then
  echo -e "  ${OK}  Using pre-compiled build ${CYN}dist-compiled/${R}"
  BACKEND_CMD="node dist-compiled/index.minimal.js"
else
  echo -e "  ${ARROW}  No pre-compiled build found, compiling..."
  (
    cd backend
    npx tsc --outDir dist-compiled \
      --target ES2022 --module nodenext --moduleResolution nodenext \
      --esModuleInterop true --skipLibCheck true --resolveJsonModule true \
      --declaration false --strict false --noEmit false \
      src/index.minimal.ts 2>/tmp/qestro-tsc.log
  ) &
  COMPILE_PID=$!
  spinner $COMPILE_PID "Compiling backend with ${CYN}tsc${R}..."
  wait $COMPILE_PID 2>/dev/null
  TSC_EXIT=$?

  if [ $TSC_EXIT -eq 0 ]; then
    echo -e "  ${OK}  Backend compiled ${GRN}successfully${R}                          "
    BACKEND_CMD="node dist-compiled/index.minimal.js"
  else
    echo -e "  ${FAIL}  Compilation failed. Check /tmp/qestro-tsc.log"
    cat /tmp/qestro-tsc.log | head -20
    exit 1
  fi
fi

speak "Backend compiled."

# ── Phase 3: Start Servers ───────────────────────────────────
section "PHASE 3 — START SERVERS"

# Backend
echo -e "  ${SPARK}  Starting backend on port ${BLU}${BACKEND_PORT}${R}..."
(
  cd backend
  PORT=$BACKEND_PORT $BACKEND_CMD 2>&1 | while IFS= read -r line; do
    echo -e "      ${GRAY}[api] $line${R}"
  done
) &
BACKEND_PID=$!
sleep 1

# Wait for backend
echo -ne "  ${CYN}⠋${R}  Waiting for backend..."
if wait_for_port $BACKEND_PORT 15; then
  echo -e "\r  ${OK}  Backend          ${GRN}http://localhost:${BACKEND_PORT}${R}              "
  speak "Backend is online."
else
  echo -e "\r  ${FAIL}  Backend failed to start. Check logs above."
  exit 1
fi

# Frontend — check if dist exists
if [ -d "frontend/dist" ] && [ -f "frontend/dist/index.html" ]; then
  # Serve static dist with proxy
  echo -e "  ${SPARK}  Starting frontend (static + proxy) on port ${BLU}${FRONTEND_PORT}${R}..."

  # Create inline server script
  SERVE_SCRIPT="/tmp/qestro-serve-$$.mjs"
  rm -f "$SERVE_SCRIPT"
  cat > "$SERVE_SCRIPT" << 'SERVEJS'
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const FRONTEND_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist');
const API_PORT = parseInt(process.env.BACKEND_PORT || '8787');
const PORT = parseInt(process.env.FRONTEND_PORT || '3000');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4',
};

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
    const opts = {
      hostname: 'localhost', port: API_PORT,
      path: req.url, method: req.method, headers: req.headers,
    };
    const proxy = http.request(opts, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxy.on('error', () => { res.writeHead(502); res.end('Backend unavailable'); });
    req.pipe(proxy);
    return;
  }
  let filePath = path.join(FRONTEND_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath)) filePath = path.join(FRONTEND_DIR, 'index.html');
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Frontend serving on http://localhost:${PORT}`));
SERVEJS

  # Fix path — the script is in /tmp, so we need absolute path
  sed -i.bak "s|path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist')|'$(pwd)/frontend/dist'|" "$SERVE_SCRIPT" 2>/dev/null || \
  sed -i '' "s|path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist')|'$(pwd)/frontend/dist'|" "$SERVE_SCRIPT"

  BACKEND_PORT=$BACKEND_PORT FRONTEND_PORT=$FRONTEND_PORT node "$SERVE_SCRIPT" 2>&1 | while IFS= read -r line; do
    echo -e "      ${GRAY}[web] $line${R}"
  done &
  FRONTEND_PID=$!
  sleep 2
  echo -e "  ${OK}  Frontend         ${GRN}http://localhost:${FRONTEND_PORT}${R}"
  speak "Frontend is online."
else
  # Use Vite dev server
  echo -e "  ${SPARK}  Starting Vite dev server on port ${BLU}${FRONTEND_PORT}${R}..."
  (
    cd frontend
    npx vite --port $FRONTEND_PORT --host 2>&1 | while IFS= read -r line; do
      echo -e "      ${GRAY}[vite] $line${R}"
    done
  ) &
  FRONTEND_PID=$!
  sleep 4
  echo -e "  ${OK}  Frontend (Vite)  ${GRN}http://localhost:${FRONTEND_PORT}${R}"
  speak "Frontend dev server is online."
fi

# ── Phase 4: Health Checks ───────────────────────────────────
section "PHASE 4 — HEALTH CHECKS"

PASS=0
TOTAL=6

run_test() {
  local name=$1 cmd=$2 expect=$3
  TOTAL_RAN=$((TOTAL_RAN+1))
  result=$(eval "$cmd" 2>/dev/null)
  if echo "$result" | grep -q "$expect"; then
    PASS=$((PASS+1))
    echo -e "  ${OK}  $name"
  else
    echo -e "  ${FAIL}  $name"
    echo -e "      ${RED}${result:0:120}${R}"
  fi
}

run_test "Backend health" \
  "curl -sf http://localhost:${BACKEND_PORT}/health" \
  "healthy"

run_test "Frontend serves HTML" \
  "curl -sf http://localhost:${FRONTEND_PORT}" \
  "Qestro"

run_test "Login returns token" \
  "curl -sf -X POST http://localhost:${BACKEND_PORT}/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"test@qestro.io\",\"password\":\"test123\"}'" \
  "Login successful"

run_test "Register returns token" \
  "curl -sf -X POST http://localhost:${BACKEND_PORT}/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"new@test.com\",\"password\":\"Test1234\",\"firstName\":\"New\"}'" \
  "registered"

run_test "Auth check (session)" \
  "curl -sf http://localhost:${BACKEND_PORT}/api/auth/me -H 'Authorization: Bearer mock-jwt-access-test'" \
  "email"

run_test "API proxy (${FRONTEND_PORT} -> ${BACKEND_PORT})" \
  "curl -sf http://localhost:${FRONTEND_PORT}/health" \
  "healthy"

echo ""
if [ "$PASS" -eq "$TOTAL" ]; then
  echo -e "  ${BG_GRN}${WHT}${B}  ALL $TOTAL TESTS PASSED  ${R}"
  speak "All $TOTAL tests passed. Questro is fully operational."
else
  echo -e "  ${BG_RED}${WHT}${B}  $PASS / $TOTAL TESTS PASSED  ${R}"
  speak "$PASS of $TOTAL tests passed. Check the output for errors."
fi

# ── Final Dashboard ──────────────────────────────────────────
echo ""
echo ""
echo -e "  ${B}${MAG}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}"
echo -e "  ${B}${WHT}  QESTRO IS RUNNING${R}"
echo -e "  ${MAG}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}"
echo ""
echo -e "  ${B}Env${R}         ${ENV_COLOR}${B}${ENV_LABEL}${R}"
echo -e "  ${B}App${R}         ${UL}http://localhost:${FRONTEND_PORT}${R}"
echo -e "  ${B}API${R}         ${UL}http://localhost:${BACKEND_PORT}${R}"
echo -e "  ${B}Health${R}      ${UL}http://localhost:${BACKEND_PORT}/health${R}"
echo ""
echo -e "  ${B}Auth${R}        Sign up at ${UL}http://localhost:${FRONTEND_PORT}/register${R}"
echo ""
echo -e "  ${DIM}Press ${WHT}Ctrl+C${R}${DIM} to stop all servers${R}"
echo -e "  ${MAG}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}"
echo ""

speak "Questro is live in ${ENV_LABEL} mode at localhost ${FRONTEND_PORT}. Happy testing!"

# Open browser (macOS only)
if [[ "$(uname)" == "Darwin" ]] && command -v open &>/dev/null; then
  sleep 1
  open "http://localhost:${FRONTEND_PORT}"
fi

# ── Keep alive ───────────────────────────────────────────────
wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
