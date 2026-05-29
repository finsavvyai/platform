#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"
QUERYLENS_DIR="$ROOT/lens/api-java"
APP_DIR="$ROOT/queryflux"
LOG_DIR="$ROOT/.logs"

mkdir -p "$LOG_DIR"

# ─── Ports ──────────────────────────────────────────────────────────────────
PORT_GO=8080        # Go backend
PORT_NODE=8082      # Node.js/Express server
PORT_QUERYLENS=8093 # Spring Boot QueryLens API
PORT_WEB=5198       # Vite frontend
PORT_WEBSITE=3001   # Next.js website

# ─── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── Kill anything already on a port ────────────────────────────────────────
kill_port() {
  local port=$1
  local pid
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    warn "Port $port in use (PID $pid) — killing..."
    kill -9 $pid 2>/dev/null || true
    sleep 0.5
  fi
}

# ─── Wait for a port to become open ─────────────────────────────────────────
wait_for_port() {
  local port=$1 label=$2 timeout=${3:-30}
  local i=0
  while ! nc -z localhost "$port" 2>/dev/null; do
    sleep 1
    i=$((i+1))
    [[ $i -ge $timeout ]] && die "$label did not start within ${timeout}s"
  done
  success "$label is up on :$port"
}

# ─── Pre-flight checks ───────────────────────────────────────────────────────
[[ -z "${OPENAI_API_KEY:-}" ]] && die "OPENAI_API_KEY is not set. Export it before running this script."

QUERYLENS_JAR=$(ls "$QUERYLENS_DIR/target/querylens-api-"*.jar 2>/dev/null | head -1)
[[ -z "$QUERYLENS_JAR" ]] && die "QueryLens JAR not found. Run:  cd $QUERYLENS_DIR && mvn -s settings-central.xml package -DskipTests"

JAVA_BIN=$(/usr/libexec/java_home -v 17+ 2>/dev/null)/bin/java
[[ ! -x "$JAVA_BIN" ]] && die "No Java 17+ found. Install one via: brew install --cask corretto"

# ─── Free all ports ──────────────────────────────────────────────────────────
for p in $PORT_GO $PORT_NODE $PORT_QUERYLENS $PORT_WEB $PORT_WEBSITE; do
  kill_port "$p"
done

# ─────────────────────────────────────────────────────────────────────────────
# 1. Go backend  →  :8080
# ─────────────────────────────────────────────────────────────────────────────
info "Starting Go backend on :$PORT_GO ..."
(
  cd "$BACKEND_DIR"
  PORT=$PORT_GO \
  DATABASE_URL="postgres://$(whoami)@localhost:5432/queryflux_dev?sslmode=disable" \
  LOG_LEVEL=info \
  JWT_SECRET=dev-secret-key-local \
  ENVIRONMENT=development \
  ALLOWED_ORIGINS="http://localhost:$PORT_WEB,http://localhost:$PORT_WEBSITE,http://localhost:$PORT_NODE,http://127.0.0.1:$PORT_WEB" \
  go run cmd/api/main.go >> "$LOG_DIR/go-backend.log" 2>&1
) &
echo $! > "$LOG_DIR/go-backend.pid"
wait_for_port $PORT_GO "Go backend" 30

# ─────────────────────────────────────────────────────────────────────────────
# 2. Node.js/Express server  →  :8082
# ─────────────────────────────────────────────────────────────────────────────
info "Starting Node.js server on :$PORT_NODE ..."
mkdir -p "$APP_DIR/data"
(
  cd "$APP_DIR"
  PORT=$PORT_NODE \
  JWT_SECRET=dev-secret-key-local \
  npm run dev:server >> "$LOG_DIR/node-server.log" 2>&1
) &
echo $! > "$LOG_DIR/node-server.pid"
wait_for_port $PORT_NODE "Node.js server" 30

# ─────────────────────────────────────────────────────────────────────────────
# 3. QueryLens API (Spring Boot)  →  :8093
# ─────────────────────────────────────────────────────────────────────────────
info "Starting QueryLens API on :$PORT_QUERYLENS ..."
(
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  "$JAVA_BIN" -jar "$QUERYLENS_JAR" --server.port=$PORT_QUERYLENS >> "$LOG_DIR/querylens-api.log" 2>&1
) &
echo $! > "$LOG_DIR/querylens-api.pid"
wait_for_port $PORT_QUERYLENS "QueryLens API" 60

# ─────────────────────────────────────────────────────────────────────────────
# 4. Vite web app  →  :5198
# ─────────────────────────────────────────────────────────────────────────────
info "Starting Vite web app on :$PORT_WEB ..."
(
  cd "$APP_DIR"
  npm run dev:web >> "$LOG_DIR/frontend.log" 2>&1
) &
echo $! > "$LOG_DIR/frontend.pid"
wait_for_port $PORT_WEB "Vite web app" 30

# ─────────────────────────────────────────────────────────────────────────────
# 5. Next.js website  →  :3001
# ─────────────────────────────────────────────────────────────────────────────
info "Starting Next.js website on :$PORT_WEBSITE ..."
(
  cd "$APP_DIR/website"
  NODE_ENV=development ./node_modules/.bin/next dev -p $PORT_WEBSITE >> "$LOG_DIR/website.log" 2>&1
) &
echo $! > "$LOG_DIR/website.pid"
wait_for_port $PORT_WEBSITE "Next.js website" 60

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  All services running${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Vite web app    →  ${BLUE}http://localhost:$PORT_WEB${NC}"
echo -e "  Next.js website →  ${BLUE}http://localhost:$PORT_WEBSITE${NC}"
echo -e "  Go backend      →  ${BLUE}http://localhost:$PORT_GO${NC}"
echo -e "  Node.js server  →  ${BLUE}http://localhost:$PORT_NODE${NC}"
echo -e "  QueryLens API   →  ${BLUE}http://localhost:$PORT_QUERYLENS${NC}"
echo ""
echo -e "  Logs in ${YELLOW}$LOG_DIR/${NC}"
echo -e "  Stop all with  ${YELLOW}./stop-all.sh${NC}"
echo ""

# Keep alive — Ctrl-C stops everything
ALL_PIDS=$(cat "$LOG_DIR"/*.pid 2>/dev/null | tr '\n' ' ')
trap 'echo ""; info "Stopping all services..."; kill $ALL_PIDS 2>/dev/null; exit 0' INT TERM
wait
