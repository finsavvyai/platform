#!/bin/bash

# QuantumBeam.io - InfluxDB Cluster Health Check Script
# This script monitors the health of the InfluxDB cluster and its components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INFLUXDB_HOSTS=("localhost" "localhost" "localhost")
INFLUXDB_PORTS=(8086 8087 8088)
INFLUXDB_LB_PORT=8089
CHRONOGRAF_PORT=8888
KAPACITOR_PORT=9092
GRAFANA_PORT=3000
INFLUXDB_EXPORTER_PORT=9122

# Health check thresholds
WARNING_QUERY_TIME_MS=1000
CRITICAL_QUERY_TIME_MS=5000
WARNING_DISK_USAGE=80
CRITICAL_DISK_USAGE=90
MIN_NODES=2

# Global variables
OVERALL_HEALTH=0
FAILED_CHECKS=()

# Functions
print_header() {
    echo -e "${BLUE}🏥 QuantumBeam.io - InfluxDB Cluster Health Check${NC}"
    echo -e "${BLUE}==============================================${NC}"
    echo ""
}

print_status() {
    local status=$1
    local message=$2

    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            OVERALL_HEALTH=1
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            OVERALL_HEALTH=2
            FAILED_CHECKS+=("$message")
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

check_influxdb_node() {
    local host=$1
    local port=$2
    local name=$3

    # Check HTTP connectivity
    if curl -s -f "http://$host:$port/health" >/dev/null 2>&1; then
        print_status "OK" "$name is reachable"
    else
        print_status "ERROR" "$name is not reachable"
        return 1
    fi

    # Check detailed health
    health_response=$(curl -s "http://$host:$port/health" 2>/dev/null)
    if [[ $? -eq 0 ]] && [[ "$health_response" =~ \"name\":\"influxdb\" ]]; then
        print_status "OK" "$name health endpoint responding"
    else
        print_status "WARNING" "$name health endpoint not responding properly"
    fi

    # Check query performance
    start_time=$(date +%s%N)
    if curl -s -f "http://$host:$port/api/v2/query" \
        -H "Authorization: Token quantumbeam_primary_token" \
        -H "Content-Type: application/json" \
        -d '{"query":"buckets() |> limit(1)"}' >/dev/null 2>&1; then
        end_time=$(date +%s%N)
        query_time_ms=$(( (end_time - start_time) / 1000000 ))

        if [[ $query_time_ms -gt $CRITICAL_QUERY_TIME_MS ]]; then
            print_status "ERROR" "$name query performance is critical: ${query_time_ms}ms"
        elif [[ $query_time_ms -gt $WARNING_QUERY_TIME_MS ]]; then
            print_status "WARNING" "$name query performance is slow: ${query_time_ms}ms"
        else
            print_status "OK" "$name query performance: ${query_time_ms}ms"
        fi
    else
        print_status "WARNING" "$name query test failed (possibly authentication issue)"
    fi

    return 0
}

check_influxdb_metrics() {
    local host=$1
    local port=$2
    local name=$3

    # Check metrics endpoint
    if curl -s -f "http://$host:$port/metrics" >/dev/null 2>&1; then
        print_status "OK" "$name metrics endpoint is accessible"
    else
        print_status "WARNING" "$name metrics endpoint is not accessible"
        return 1
    fi

    # Get basic metrics
    metrics_response=$(curl -s "http://$host:$port/metrics" 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        # Extract uptime if available
        uptime=$(echo "$metrics_response" | grep "process_uptime_seconds" | head -n1 | cut -d' ' -f2)
        if [[ -n "$uptime" ]]; then
            uptime_hours=$((uptime / 3600))
            print_status "INFO" "$name uptime: ${uptime_hours}h"
        fi

        # Extract HTTP requests
        http_requests=$(echo "$metrics_response" | grep "http_requests_total" | awk '{sum+=$2} END {print sum+0}')
        if [[ "$http_requests" -gt 0 ]]; then
            print_status "INFO" "$name total HTTP requests: $http_requests"
        fi
    fi

    return 0
}

check_load_balancer() {
    if curl -s -f "http://localhost:$INFLUXDB_LB_PORT/health" >/dev/null 2>&1; then
        print_status "OK" "InfluxDB load balancer is accessible"
    else
        print_status "ERROR" "InfluxDB load balancer is not accessible"
        return 1
    fi
}

check_service_port() {
    local port=$1
    local service_name=$2
    local health_path=${3:-"/"}

    if curl -s -f "http://localhost:$port$health_path" >/dev/null 2>&1; then
        print_status "OK" "$service_name is running on port $port"
        return 0
    else
        print_status "ERROR" "$service_name is not accessible on port $port"
        return 1
    fi
}

check_disk_usage() {
    local path=$1
    local service_name=$2

    if [[ -d "$path" ]]; then
        usage=$(df "$path" | awk 'NR==2 {print $5}' | sed 's/%//')

        if [[ $usage -gt $CRITICAL_DISK_USAGE ]]; then
            print_status "ERROR" "$service_name disk usage is critical: ${usage}%"
            return 1
        elif [[ $usage -gt $WARNING_DISK_USAGE ]]; then
            print_status "WARNING" "$service_name disk usage is high: ${usage}%"
        else
            print_status "OK" "$service_name disk usage: ${usage}%"
        fi
    else
        print_status "WARNING" "Cannot check disk usage for $service_name (path not found)"
    fi

    return 0
}

check_bucket_health() {
    local host=$1
    local port=$2
    local name=$3

    # Check if we can list buckets
    if curl -s -f "http://$host:$port/api/v2/buckets" \
        -H "Authorization: Token quantumbeam_primary_token" >/dev/null 2>&1; then
        print_status "OK" "$name bucket API is accessible"
    else
        print_status "WARNING" "$name bucket API is not accessible"
        return 1
    fi

    # Get bucket count
    buckets_response=$(curl -s "http://$host:$port/api/v2/buckets" \
        -H "Authorization: Token quantumbeam_primary_token" 2>/dev/null)

    if [[ $? -eq 0 ]]; then
        bucket_count=$(echo "$buckets_response" | grep -o '"name"' | wc -l)
        print_status "INFO" "$name bucket count: $bucket_count"
    fi

    return 0
}

check_replication_status() {
    print_status "INFO" "Checking replication status..."

    local healthy_nodes=0
    for i in "${!INFLUXDB_HOSTS[@]}"; do
        host="${INFLUXDB_HOSTS[$i]}"
        port="${INFLUXDB_PORTS[$i]}"

        if curl -s -f "http://$host:$port/health" >/dev/null 2>&1; then
            ((healthy_nodes++))
        fi
    done

    if [[ $healthy_nodes -ge $MIN_NODES ]]; then
        print_status "OK" "Replication status: $healthy_nodes/${#INFLUXDB_PORTS[@]} nodes healthy"
    else
        print_status "ERROR" "Insufficient healthy nodes: $healthy_nodes/${#INFLUXDB_PORTS[@]}"
        return 1
    fi

    return 0
}

check_system_resources() {
    print_status "INFO" "Checking system resources..."

    # Check memory usage
    if command -v free >/dev/null 2>&1; then
        memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        if [[ $memory_usage -gt 90 ]]; then
            print_status "ERROR" "System memory usage is critical: ${memory_usage}%"
        elif [[ $memory_usage -gt 80 ]]; then
            print_status "WARNING" "System memory usage is high: ${memory_usage}%"
        else
            print_status "OK" "System memory usage: ${memory_usage}%"
        fi
    fi

    # Check CPU load
    if command -v uptime >/dev/null 2>&1; then
        load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        print_status "INFO" "System load average (1m): $load_avg"
    fi

    # Check disk I/O
    if command -v iostat >/dev/null 2>&1; then
        io_wait=$(iostat -c 1 2 | tail -n 1 | awk '{print $4}')
        print_status "INFO" "System I/O wait: ${io_wait}%"
    fi
}

perform_query_test() {
    print_status "INFO" "Performing query performance test..."

    local host="localhost"
    local port=$INFLUXDB_LB_PORT

    # Test simple aggregation query
    start_time=$(date +%s%N)
    if curl -s -f "http://$host:$port/api/v2/query" \
        -H "Authorization: Token quantumbeam_primary_token" \
        -H "Content-Type: application/json" \
        -d '{
            "query": "from(bucket: \"metrics\") |> range(start: -1h) |> count()",
            "type": "flux"
        }' >/dev/null 2>&1; then
        end_time=$(date +%s%N)
        query_time_ms=$(( (end_time - start_time) / 1000000 ))

        if [[ $query_time_ms -gt $CRITICAL_QUERY_TIME_MS ]]; then
            print_status "ERROR" "Query performance test failed: ${query_time_ms}ms"
        elif [[ $query_time_ms -gt $WARNING_QUERY_TIME_MS ]]; then
            print_status "WARNING" "Query performance test slow: ${query_time_ms}ms"
        else
            print_status "OK" "Query performance test: ${query_time_ms}ms"
        fi
    else
        print_status "WARNING" "Query performance test failed (possibly no data or auth issue)"
    fi
}

check_log_errors() {
    print_status "INFO" "Checking for recent errors in logs..."

    # Check for InfluxDB errors
    if docker logs quantumbeam-influxdb-primary 2>&1 | tail -n 50 | grep -i "error\|fatal\|panic" >/dev/null 2>&1; then
        print_status "WARNING" "Recent errors found in InfluxDB primary logs"
    else
        print_status "OK" "No recent errors in InfluxDB primary logs"
    fi

    # Check for Chronograf errors
    if docker logs quantumbeam-chronograf 2>&1 | tail -n 50 | grep -i "error\|fatal" >/dev/null 2>&1; then
        print_status "WARNING" "Recent errors found in Chronograf logs"
    else
        print_status "OK" "No recent errors in Chronograf logs"
    fi
}

generate_health_report() {
    echo ""
    echo -e "${BLUE}📊 Health Check Summary${NC}"
    echo -e "${BLUE}====================${NC}"

    case $OVERALL_HEALTH in
        0)
            echo -e "${GREEN}🎉 Overall Status: HEALTHY${NC}"
            ;;
        1)
            echo -e "${YELLOW}⚠️  Overall Status: WARNING${NC}"
            ;;
        2)
            echo -e "${RED}🚨 Overall Status: CRITICAL${NC}"
            ;;
    esac

    if [[ ${#FAILED_CHECKS[@]} -gt 0 ]]; then
        echo ""
        echo -e "${RED}Failed Checks:${NC}"
        for check in "${FAILED_CHECKS[@]}"; do
            echo -e "${RED}  - $check${NC}"
        done
    fi

    echo ""
    echo -e "${BLUE}Cluster Configuration:${NC}"
    echo "  - InfluxDB Nodes: ${#INFLUXDB_PORTS[@]}"
    echo "  - Load Balancer: Port $INFLUXDB_LB_PORT"
    echo "  - Chronograf: Port $CHRONOGRAF_PORT"
    echo "  - Kapacitor: Port $KAPACITOR_PORT"
    echo "  - Grafana: Port $GRAFANA_PORT"

    echo ""
    echo -e "${BLUE}Recommendations:${NC}"
    echo "- Monitor query performance and optimize slow queries"
    echo "- Set up automated alerts for disk usage and node availability"
    echo "- Regularly backup InfluxDB data and configurations"
    echo "- Implement proper retention policies to manage disk usage"
    echo "- Monitor replication lag and node synchronization"
    echo "- Set up log aggregation and monitoring"

    # Exit with appropriate code
    exit $OVERALL_HEALTH
}

# Main health check execution
main() {
    print_header
    print_status "INFO" "Starting InfluxDB cluster health check..."
    echo ""

    # Check InfluxDB nodes
    print_status "INFO" "Checking InfluxDB nodes..."
    for i in "${!INFLUXDB_HOSTS[@]}"; do
        host="${INFLUXDB_HOSTS[$i]}"
        port="${INFLUXDB_PORTS[$i]}"
        node_name="InfluxDB Node $((i+1))"

        check_influxdb_node "$host" "$port" "$node_name"
        check_influxdb_metrics "$host" "$port" "$node_name"
        check_disk_usage "/var/lib/influxdb2" "$node_name"
    done
    echo ""

    # Check load balancer
    print_status "INFO" "Checking load balancer..."
    check_load_balancer
    check_bucket_health "localhost" $INFLUXDB_LB_PORT "Load Balancer"
    echo ""

    # Check auxiliary services
    print_status "INFO" "Checking auxiliary services..."
    check_service_port $CHRONOGRAF_PORT "Chronograf" "/chronograf/v1"
    check_service_port $KAPACITOR_PORT "Kapacitor" "/kapacitor/v1"
    check_service_port $GRAFANA_PORT "Grafana" "/api/health"
    check_service_port $INFLUXDB_EXPORTER_PORT "InfluxDB Exporter" "/metrics"
    echo ""

    # Check replication
    print_status "INFO" "Checking replication status..."
    check_replication_status
    echo ""

    # Perform query test
    print_status "INFO" "Performing functionality tests..."
    perform_query_test
    echo ""

    # Check system resources
    print_status "INFO" "Checking system resources..."
    check_system_resources
    echo ""

    # Check for recent errors
    print_status "INFO" "Checking log files..."
    check_log_errors
    echo ""

    # Generate summary
    generate_health_report
}

# Check if required tools are available
check_dependencies() {
    local missing_tools=()

    if ! command -v curl >/dev/null 2>&1; then
        missing_tools+=("curl")
    fi

    if ! command -v docker >/dev/null 2>&1; then
        missing_tools+=("docker")
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        echo -e "${RED}Error: Missing required tools:${NC}"
        for tool in "${missing_tools[@]}"; do
            echo -e "${RED}  - $tool${NC}"
        done
        echo ""
        echo -e "${BLUE}Install missing tools and try again.${NC}"
        exit 1
    fi
}

# Script execution
check_dependencies
main "$@"