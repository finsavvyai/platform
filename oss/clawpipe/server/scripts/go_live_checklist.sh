#!/bin/bash
# FinSavvyAI Go-Live Checklist
# Run this before going live to verify all production requirements are met.
set -e

GREEN='\033[92m'
RED='\033[91m'
YELLOW='\033[93m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
    local name="$1"
    local result="$2"
    local severity="${3:-fail}"

    if [ "$result" = "true" ]; then
        echo -e "  [${GREEN}PASS${NC}] $name"
        PASS=$((PASS + 1))
    elif [ "$severity" = "warn" ]; then
        echo -e "  [${YELLOW}WARN${NC}] $name"
        WARN=$((WARN + 1))
    else
        echo -e "  [${RED}FAIL${NC}] $name"
        FAIL=$((FAIL + 1))
    fi
}

section() {
    echo ""
    echo "============================================"
    echo "  $1"
    echo "============================================"
}

MASTER_URL="${MASTER_URL:-http://localhost:8000}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
WORKER_URL="${WORKER_URL:-http://localhost:8001}"

echo "FinSavvyAI Go-Live Checklist"
echo "============================"
echo "Master:  $MASTER_URL"
echo "Gateway: $GATEWAY_URL"
echo "Worker:  $WORKER_URL"

# =============================================
section "1. Service Health"
# =============================================

MASTER_OK=$(curl -sf "$MASTER_URL/health" > /dev/null 2>&1 && echo "true" || echo "false")
check "Master server healthy" "$MASTER_OK"

GATEWAY_OK=$(curl -sf "$GATEWAY_URL/health" > /dev/null 2>&1 && echo "true" || echo "false")
check "API Gateway healthy" "$GATEWAY_OK"

WORKER_OK=$(curl -sf "$WORKER_URL/health" > /dev/null 2>&1 && echo "true" || echo "false")
check "Worker node healthy" "$WORKER_OK"

# Check nodes registered
if [ "$MASTER_OK" = "true" ]; then
    NODES=$(curl -sf "$MASTER_URL/cluster/nodes" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('nodes',d) if isinstance(d,dict) else d))" 2>/dev/null || echo "0")
    check "At least 1 worker registered ($NODES found)" "$([ "$NODES" -ge 1 ] && echo true || echo false)"
fi

# =============================================
section "2. Security"
# =============================================

# Check auth is enabled (unauthenticated should get 401/403)
AUTH_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$GATEWAY_URL/v1/models" 2>/dev/null || echo "000")
check "Authentication enabled (got $AUTH_STATUS)" "$([ "$AUTH_STATUS" = "401" ] || [ "$AUTH_STATUS" = "403" ] && echo true || echo false)"

# Check .env has no default passwords
if [ -f .env ]; then
    HAS_DEFAULTS=$(grep -c "changeme\|password\|finsavvyai$" .env 2>/dev/null || echo "0")
    check "No default passwords in .env" "$([ "$HAS_DEFAULTS" = "0" ] && echo true || echo false)"
else
    check ".env file exists" "false"
fi

# Check API keys file permissions
KEY_FILE="$HOME/.finsavvyai/api-keys.json"
if [ -f "$KEY_FILE" ]; then
    PERMS=$(stat -f "%Lp" "$KEY_FILE" 2>/dev/null || stat -c "%a" "$KEY_FILE" 2>/dev/null || echo "unknown")
    check "API keys file permissions restrictive ($PERMS)" "$([ "$PERMS" = "600" ] || [ "$PERMS" = "700" ] && echo true || echo false)" "warn"
fi

# =============================================
section "3. Monitoring & Alerting"
# =============================================

PROM_OK=$(curl -sf "http://localhost:9090/-/healthy" > /dev/null 2>&1 && echo "true" || echo "false")
check "Prometheus running" "$PROM_OK"

GRAFANA_OK=$(curl -sf "http://localhost:3000/api/health" > /dev/null 2>&1 && echo "true" || echo "false")
check "Grafana running" "$GRAFANA_OK"

ALERT_OK=$(curl -sf "http://localhost:9093/-/healthy" > /dev/null 2>&1 && echo "true" || echo "false")
check "Alertmanager running" "$ALERT_OK"

# Check metrics endpoints
MASTER_METRICS=$(curl -sf "$MASTER_URL/metrics" > /dev/null 2>&1 && echo "true" || echo "false")
check "Master metrics endpoint" "$MASTER_METRICS"

GATEWAY_METRICS=$(curl -sf "$GATEWAY_URL/metrics" > /dev/null 2>&1 && echo "true" || echo "false")
check "Gateway metrics endpoint" "$GATEWAY_METRICS"

# =============================================
section "4. Cloudflare Tunnel"
# =============================================

TUNNEL_RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -q finsavvyai-tunnel && echo "true" || echo "false")
check "Cloudflare Tunnel container running" "$TUNNEL_RUNNING" "warn"

if [ -d "cloudflare-tunnel/credentials" ]; then
    CRED_FILES=$(ls cloudflare-tunnel/credentials/*.json 2>/dev/null | wc -l)
    check "Tunnel credentials present ($CRED_FILES files)" "$([ "$CRED_FILES" -ge 1 ] && echo true || echo false)" "warn"
else
    check "Tunnel credentials directory" "false" "warn"
fi

# =============================================
section "5. Backup & Recovery"
# =============================================

check "Backup script exists" "$([ -f scripts/backup.sh ] && echo true || echo false)"
check "Restore script exists" "$([ -f scripts/restore.sh ] && echo true || echo false)"

BACKUP_DIR="${BACKUP_DIR:-/opt/finsavvyai/backups}"
if [ -d "$BACKUP_DIR" ]; then
    BACKUP_COUNT=$(ls "$BACKUP_DIR"/finsavvyai-backup-*.tar.gz 2>/dev/null | wc -l)
    check "Recent backups exist ($BACKUP_COUNT)" "$([ "$BACKUP_COUNT" -ge 1 ] && echo true || echo false)" "warn"
else
    check "Backup directory exists" "false" "warn"
fi

# Check cron job
CRON_SET=$(crontab -l 2>/dev/null | grep -c "backup.sh" || echo "0")
check "Backup cron job configured" "$([ "$CRON_SET" -ge 1 ] && echo true || echo false)" "warn"

# =============================================
section "6. Documentation"
# =============================================

check "Production topology documented" "$([ -f docs/PRODUCTION_TOPOLOGY.md ] && echo true || echo false)"
check "Incident response procedures" "$([ -f docs/INCIDENT_RESPONSE.md ] && echo true || echo false)"
check "Operational runbooks" "$([ -f docs/RUNBOOKS.md ] && echo true || echo false)"
check "Deployment guide" "$([ -f docs/guides/DEPLOYMENT.md ] && echo true || echo false)"

# =============================================
section "7. Resources"
# =============================================

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
check "Disk usage under 80% (${DISK_USAGE}%)" "$([ "$DISK_USAGE" -lt 80 ] && echo true || echo false)" "warn"

# Check memory
if command -v free &>/dev/null; then
    MEM_FREE=$(free -m | awk 'NR==2 {printf "%.0f", $7/$2*100}')
    check "Memory available >20% (${MEM_FREE}% free)" "$([ "$MEM_FREE" -gt 20 ] && echo true || echo false)" "warn"
fi

# =============================================
# Summary
# =============================================
echo ""
echo "============================================"
echo "  RESULTS"
echo "============================================"
TOTAL=$((PASS + FAIL + WARN))
echo "  Total checks: $TOTAL"
echo -e "  [${GREEN}PASS${NC}] $PASS"
echo -e "  [${RED}FAIL${NC}] $FAIL"
echo -e "  [${YELLOW}WARN${NC}] $WARN"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo -e "  ${RED}NOT READY for go-live: $FAIL critical issue(s) must be fixed${NC}"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo -e "  ${YELLOW}READY with warnings: $WARN non-critical issue(s)${NC}"
    exit 0
else
    echo -e "  ${GREEN}READY for go-live! All checks passed.${NC}"
    exit 0
fi
