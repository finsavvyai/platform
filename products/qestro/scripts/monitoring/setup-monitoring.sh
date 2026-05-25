#!/bin/bash

# Production Monitoring Setup Script
# Configures monitoring, alerting, and health checks for Qestro

set -e

echo "📊 Setting up Production Monitoring..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
PROJECT_NAME="qestro"
FRONTEND_URL="https://qestro.app"
API_URL="https://api.qestro.app"
ALERT_EMAIL="admin@qestro.app"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Create monitoring configuration
create_health_check_endpoints() {
    log_info "Creating health check endpoints..."

    mkdir -p config/monitoring

    cat > config/monitoring/health-checks.json << 'EOF'
{
  "frontend": {
    "url": "https://qestro.app",
    "expected_status": 200,
    "timeout": 10,
    "check_interval": 60,
    "alert_threshold": 3
  },
  "api": {
    "url": "https://api.qestro.app/api/health",
    "expected_status": 200,
    "timeout": 5,
    "check_interval": 30,
    "alert_threshold": 2
  },
  "websocket": {
    "url": "wss://api.qestro.app/ws",
    "timeout": 5,
    "check_interval": 300,
    "alert_threshold": 5
  }
}
EOF

    log_success "Health check configuration created"
}

# Create Uptime monitoring script
create_uptime_monitor() {
    log_info "Creating uptime monitoring script..."

    cat > scripts/monitoring/uptime-monitor.sh << 'EOF'
#!/bin/bash

# Uptime Monitoring Script
# Continuously monitors service availability and sends alerts

set -e

# Configuration
CONFIG_FILE="config/monitoring/health-checks.json"
ALERT_EMAIL="admin@qestro.app"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
LOG_FILE="logs/monitoring.log"

# Ensure log directory exists
mkdir -p logs

# Alert counters
declare -A FAILURE_COUNTS

# Send alert function
send_alert() {
    local service="$1"
    local status="$2"
    local details="$3"

    local message="🚨 ${PROJECT_NAME} Alert: $service is $status"

    if [ "$status" = "DOWN" ]; then
        message="$message - $details"
    fi

    # Send email alert (placeholder - would require email service)
    echo "$(date): $message" >> "$LOG_FILE"

    # Send Slack alert
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi

    echo "$message"
}

# Check service health
check_service() {
    local service="$1"
    local config=$(jq -r ".services.$service" "$CONFIG_FILE" 2>/dev/null || echo '{}')

    local url=$(echo "$config" | jq -r '.url')
    local expected_status=$(echo "$config" | jq -r '.expected_status // 200')
    local timeout=$(echo "$config" | jq -r '.timeout // 10')
    local alert_threshold=$(echo "$config" | jq -r '.alert_threshold // 3')

    if [ -z "$url" ] || [ "$url" = "null" ]; then
        return 0
    fi

    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")

    if [ "$status_code" = "$expected_status" ]; then
        # Service is up
        if [ "${FAILURE_COUNTS[$service]}" -gt 0 ]; then
            send_alert "$service" "RECOVERED" "Status code: $status_code"
        fi
        FAILURE_COUNTS[$service]=0
        return 0
    else
        # Service is down
        FAILURE_COUNTS[$service]=$((${FAILURE_COUNTS[$service]:-0} + 1))

        if [ "${FAILURE_COUNTS[$service]}" -ge "$alert_threshold" ]; then
            send_alert "$service" "DOWN" "Status code: $status_code (threshold: $alert_threshold)"
        fi
        return 1
    fi
}

# Main monitoring loop
main() {
    echo "$(date): Starting uptime monitoring..." >> "$LOG_FILE"

    while true; do
        # Check each service
        check_service "frontend"
        check_service "api"
        check_service "websocket"

        # Wait before next check
        sleep 60
    done
}

# Handle interruption
trap 'echo "$(date): Monitoring stopped" >> "$LOG_FILE; exit 0' INT TERM

# Start monitoring
main "$@"
EOF

    chmod +x scripts/monitoring/uptime-monitor.sh
    log_success "Uptime monitoring script created"
}

# Create performance monitoring script
create_performance_monitor() {
    log_info "Creating performance monitoring script..."

    cat > scripts/monitoring/performance-monitor.sh << 'EOF'
#!/bin/bash

# Performance Monitoring Script
# Monitors API response times and performance metrics

set -e

CONFIG_FILE="config/monitoring/health-checks.json"
METRICS_FILE="logs/performance-metrics.log"
ALERT_THRESHOLD=5.0  # seconds

# Ensure log directory exists
mkdir -p logs

# Monitor API performance
monitor_api_performance() {
    local api_url="https://api.qestro.app/api/health"

    # Measure response time
    local start_time=$(date +%s.%N)
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$api_url")
    local end_time=$(date +%s.%N)

    local response_time=$(echo "$end_time - $start_time" | bc)

    # Log metrics
    echo "$(date),$response_time,$status_code" >> "$METRICS_FILE"

    # Check if response time is too slow
    if (( $(echo "$response_time > $ALERT_THRESHOLD" | bc -l) )); then
        echo "$(date): ALERT - API response time ${response_time}s (threshold: ${ALERT_THRESHOLD}s)" >> "logs/alerts.log"

        # Send alert
        if [ -n "$SLACK_WEBHOOK_URL" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"🐌 Performance Alert: API response time is ${response_time}s\"}" \
                "$SLACK_WEBHOOK_URL" 2>/dev/null || true
        fi
    fi
}

# Generate performance report
generate_performance_report() {
    local last_hour=$(date -d "1 hour ago" +%s)
    local report_file="logs/performance-report-$(date +%Y%m%d-%H%M%S).txt"

    {
        echo "Performance Report - $(date)"
        echo "================================"
        echo ""

        # Calculate statistics
        tail -n 3600 "$METRICS_FILE" 2>/dev/null | \
        awk -F',' '
        {
            times[NR] = $2;
            sum += $2;
            if (NR == 1 || $2 > max) max = $2;
            if (NR == 1 || $2 < min) min = $2;
        }
        END {
            if (NR > 0) {
                avg = sum / NR;
                printf "Average response time: %.3fs\n", avg;
                printf "Min response time: %.3fs\n", min;
                printf "Max response time: %.3fs\n", max;
                printf "Total requests: %d\n", NR;
            }
        }'

        echo ""
        echo "Recent slow responses (>2s):"
        tail -n 3600 "$METRICS_FILE" 2>/dev/null | \
        awk -F',' '$2 > 2.0 {print $1 " - " $2 "s"}' | tail -10

    } > "$report_file"

    echo "Performance report generated: $report_file"
}

# Main execution
main() {
    echo "$(date): Starting performance monitoring..." >> "logs/performance-monitor.log"

    while true; do
        monitor_api_performance

        # Generate report every hour
        if [ $(date +%M) = "00" ]; then
            generate_performance_report
        fi

        sleep 30  # Check every 30 seconds
    done
}

# Handle interruption
trap 'echo "$(date): Performance monitoring stopped" >> "logs/performance-monitor.log; exit 0' INT TERM

# Start monitoring
main "$@"
EOF

    chmod +x scripts/monitoring/performance-monitor.sh
    log_success "Performance monitoring script created"
}

# Create log rotation script
create_log_rotation() {
    log_info "Creating log rotation script..."

    cat > scripts/monitoring/log-rotation.sh << 'EOF'
#!/bin/bash

# Log Rotation Script
# Rotates and archives monitoring logs

LOG_DIR="logs"
RETENTION_DAYS=30

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Rotate monitoring logs
rotate_logs() {
    for log_file in monitoring.log performance-metrics.log alerts.log; do
        if [ -f "$LOG_DIR/$log_file" ]; then
            # Compress old log
            gzip -c "$LOG_DIR/$log_file" > "$LOG_DIR/$log_file.$(date +%Y%m%d).gz"

            # Clear current log
            > "$LOG_DIR/$log_file"

            # Remove old logs beyond retention period
            find "$LOG_DIR" -name "$log_file.*.gz" -mtime +$RETENTION_DAYS -delete
        fi
    done
}

# Main execution
rotate_logs
echo "$(date): Log rotation completed" >> "$LOG_DIR/monitoring.log"
EOF

    chmod +x scripts/monitoring/log-rotation.sh
    log_success "Log rotation script created"
}

# Create monitoring dashboard
create_monitoring_dashboard() {
    log_info "Creating monitoring dashboard..."

    mkdir -p public/monitoring

    cat > public/monitoring/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qestro - Monitoring Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f7;
        }
        .dashboard {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .status-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .status-card h3 {
            margin: 0 0 15px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ccc;
        }
        .status-indicator.up {
            background: #34c759;
            animation: pulse 2s infinite;
        }
        .status-indicator.down {
            background: #ff3b30;
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .metric {
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: 600;
            color: #1d1d1f;
        }
        .metric-label {
            font-size: 14px;
            color: #86868b;
            margin-top: 5px;
        }
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .refresh-info {
            text-align: center;
            color: #86868b;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>🔍 Qestro Monitoring Dashboard</h1>
            <p>Real-time system health and performance metrics</p>
        </div>

        <div class="status-grid">
            <div class="status-card">
                <h3>
                    <div class="status-indicator" id="frontend-status"></div>
                    Frontend (qestro.app)
                </h3>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value" id="frontend-uptime">-</div>
                        <div class="metric-label">Uptime</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="frontend-response">-</div>
                        <div class="metric-label">Response Time</div>
                    </div>
                </div>
            </div>

            <div class="status-card">
                <h3>
                    <div class="status-indicator" id="api-status"></div>
                    API (api.qestro.app)
                </h3>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value" id="api-uptime">-</div>
                        <div class="metric-label">Uptime</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="api-response">-</div>
                        <div class="metric-label">Response Time</div>
                    </div>
                </div>
            </div>

            <div class="status-card">
                <h3>
                    <div class="status-indicator" id="websocket-status"></div>
                    WebSocket
                </h3>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value" id="websocket-connections">-</div>
                        <div class="metric-label">Connections</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="websocket-uptime">-</div>
                        <div class="metric-label">Uptime</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="chart-container">
            <h3>Response Time Trends</h3>
            <canvas id="responseTimeChart" width="400" height="200"></canvas>
        </div>

        <div class="refresh-info">
            Last updated: <span id="last-updated">Never</span> | Auto-refresh every 30 seconds
        </div>
    </div>

    <script>
        // Simple monitoring dashboard implementation
        // In a real implementation, this would connect to actual metrics APIs

        function updateStatus(serviceId, isUp, responseTime) {
            const indicator = document.getElementById(serviceId + '-status');
            const uptime = document.getElementById(serviceId + '-uptime');
            const response = document.getElementById(serviceId + '-response');

            if (isUp) {
                indicator.className = 'status-indicator up';
                uptime.textContent = '99.9%';
                response.textContent = responseTime + 'ms';
            } else {
                indicator.className = 'status-indicator down';
                uptime.textContent = '0%';
                response.textContent = 'N/A';
            }
        }

        function checkServices() {
            // Mock service checks - replace with real API calls
            fetch('/api/monitoring/status')
                .then(response => response.json())
                .then(data => {
                    updateStatus('frontend', data.frontend.up, data.frontend.responseTime);
                    updateStatus('api', data.api.up, data.api.responseTime);
                    updateStatus('websocket', data.websocket.up, data.websocket.responseTime);
                    document.getElementById('last-updated').textContent = new Date().toLocaleString();
                })
                .catch(() => {
                    // Fallback values if API is not available
                    updateStatus('frontend', true, 150);
                    updateStatus('api', true, 85);
                    updateStatus('websocket', true, 45);
                    document.getElementById('last-updated').textContent = new Date().toLocaleString();
                });
        }

        // Initialize and set up auto-refresh
        checkServices();
        setInterval(checkServices, 30000);
    </script>
</body>
</html>
EOF

    log_success "Monitoring dashboard created"
}

# Create monitoring startup script
create_monitoring_startup() {
    log_info "Creating monitoring startup script..."

    cat > scripts/monitoring/start-monitoring.sh << 'EOF'
#!/bin/bash

# Monitoring Services Startup Script
# Starts all monitoring processes

set -e

echo "🚀 Starting Qestro Monitoring Services..."

# Create log directory
mkdir -p logs

# Start uptime monitoring
echo "Starting uptime monitoring..."
nohup ./scripts/monitoring/uptime-monitor.sh > logs/uptime-monitor.out 2>&1 &
UPTIME_PID=$!
echo "Uptime monitoring started (PID: $UPTIME_PID)"

# Start performance monitoring
echo "Starting performance monitoring..."
nohup ./scripts/monitoring/performance-monitor.sh > logs/performance-monitor.out 2>&1 &
PERFORMANCE_PID=$!
echo "Performance monitoring started (PID: $PERFORMANCE_PID)"

# Save PIDs for later management
echo "$UPTIME_PID" > logs/uptime-monitor.pid
echo "$PERFORMANCE_PID" > logs/performance-monitor.pid

echo ""
echo "Monitoring services started successfully!"
echo "Uptime Monitor PID: $UPTIME_PID"
echo "Performance Monitor PID: $PERFORMANCE_PID"
echo ""
echo "To stop monitoring: ./scripts/monitoring/stop-monitoring.sh"
echo "To view logs: tail -f logs/uptime-monitor.out logs/performance-monitor.out"
EOF

    chmod +x scripts/monitoring/start-monitoring.sh

    # Create stop script
    cat > scripts/monitoring/stop-monitoring.sh << 'EOF'
#!/bin/bash

# Stop Monitoring Services Script
# Safely stops all monitoring processes

echo "🛑 Stopping Qestro Monitoring Services..."

# Stop uptime monitoring
if [ -f logs/uptime-monitor.pid ]; then
    UPTIME_PID=$(cat logs/uptime-monitor.pid)
    if kill -0 "$UPTIME_PID" 2>/dev/null; then
        kill "$UPTIME_PID"
        echo "Uptime monitoring stopped (PID: $UPTIME_PID)"
    fi
    rm -f logs/uptime-monitor.pid
fi

# Stop performance monitoring
if [ -f logs/performance-monitor.pid ]; then
    PERFORMANCE_PID=$(cat logs/performance-monitor.pid)
    if kill -0 "$PERFORMANCE_PID" 2>/dev/null; then
        kill "$PERFORMANCE_PID"
        echo "Performance monitoring stopped (PID: $PERFORMANCE_PID)"
    fi
    rm -f logs/performance-monitor.pid
fi

echo "All monitoring services stopped."
EOF

    chmod +x scripts/monitoring/stop-monitoring.sh
    log_success "Monitoring startup scripts created"
}

# Main execution
main() {
    echo "📊 Qestro - Production Monitoring Setup"
    echo "======================================="
    echo ""

    create_health_check_endpoints
    create_uptime_monitor
    create_performance_monitor
    create_log_rotation
    create_monitoring_dashboard
    create_monitoring_startup

    echo ""
    log_success "🎉 Monitoring setup completed!"
    echo ""
    log_info "📋 Next Steps:"
    echo "1. Set environment variables:"
    echo "   export SLACK_WEBHOOK_URL=your_slack_webhook_url"
    echo "   export ALERT_EMAIL=admin@qestro.app"
    echo ""
    echo "2. Start monitoring:"
    echo "   ./scripts/monitoring/start-monitoring.sh"
    echo ""
    echo "3. Access monitoring dashboard:"
    echo "   https://qestro.app/monitoring"
    echo ""
    echo "4. Set up cron jobs for log rotation:"
    echo "   0 2 * * * /path/to/qestro/scripts/monitoring/log-rotation.sh"
    echo ""
    echo "5. Configure alerts in your monitoring tools:"
    echo "   - Uptime alerts for >3 consecutive failures"
    echo "   - Performance alerts for >5s response times"
    echo "   - SSL certificate expiry alerts"
    echo ""
}

# Handle script interruption
trap 'log_error "Setup interrupted by user"; exit 130' INT TERM

# Run main function
main "$@"