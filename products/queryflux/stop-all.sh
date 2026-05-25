#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/.logs"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

stop_pid_file() {
  local file="$LOG_DIR/$1.pid"
  local label=$2
  if [[ -f "$file" ]]; then
    local pid
    pid=$(cat "$file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo -e "${GREEN}[OK]${NC}    Stopped $label (PID $pid)"
    fi
    rm -f "$file"
  fi
}

stop_pid_file "frontend"      "Vite web app    (:5198)"
stop_pid_file "website"       "Next.js website (:3001)"
stop_pid_file "node-server"   "Node.js server  (:8082)"
stop_pid_file "querylens-api" "QueryLens API   (:8093)"
stop_pid_file "go-backend"    "Go backend      (:8080)"

# Belt-and-suspenders: kill by port in case PIDs drifted
for port in 5198 3001 8082 8093 8080; do
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  [[ -n "$pid" ]] && kill -9 $pid 2>/dev/null && echo -e "${YELLOW}[WARN]${NC}  Force-killed stale process on :$port"
done

echo ""
echo -e "${GREEN}All services stopped.${NC}"
