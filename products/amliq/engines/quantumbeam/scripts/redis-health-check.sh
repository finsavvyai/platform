#!/bin/bash

# QuantumBeam.io - Redis Cluster Health Check Script
# This script monitors the health of the Redis cluster and its components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REDIS_MASTER_HOST="localhost"
REDIS_MASTER_PORT=6379
REDIS_REPLICA_1_HOST="localhost"
REDIS_REPLICA_1_PORT=6380
REDIS_REPLICA_2_HOST="localhost"
REDIS_REPLICA_2_PORT=6381
SENTINEL_PORTS=(26379 26380 26381)
REDIS_COMMANDER_PORT=8081
REDIS_EXPORTER_PORT=9121

# Health check thresholds
WARNING_LATENCY_MS=50
CRITICAL_LATENCY_MS=100
WARNING_MEMORY_USAGE=80
CRITICAL_MEMORY_USAGE=90
MIN_REPLICAS=2
MIN_SENTINELS=2

# Global variables
OVERALL_HEALTH=0
FAILED_CHECKS=()

# Functions
print_header() {
    echo -e "${BLUE}🏥 QuantumBeam.io - Redis Cluster Health Check${NC}"
    echo -e "${BLUE}===============================================${NC}"
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

check_redis_connectivity() {
    local host=$1
    local port=$2
    local name=$3

    if redis-cli -h "$host" -p "$port" ping >/dev/null 2>&1; then
        print_status "OK" "$name is reachable"
        return 0
    else
        print_status "ERROR" "$name is not reachable"
        return 1
    fi
}

check_redis_info() {
    local host=$1
    local port=$2
    local name=$3

    if ! redis-cli -h "$host" -p "$port" info >/dev/null 2>&1; then
        print_status "ERROR" "$name info command failed"
        return 1
    fi

    return 0
}

check_redis_memory() {
    local host=$1
    local port=$2
    local name=$3

    local memory_info=$(redis-cli -h "$host" -p "$port" info memory 2>/dev/null)
    if [[ $? -ne 0 ]]; then
        print_status "ERROR" "Could not get memory info from $name"
        return 1
    fi

    local used_memory=$(echo "$memory_info" | grep "used_memory_human:" | cut -d: -f2 | tr -d '\r')
    local max_memory=$(echo "$memory_info" | grep "maxmemory_human:" | cut -d: -f2 | tr -d '\r')

    if [[ -n "$used_memory" ]]; then
        print_status "INFO" "$name memory usage: $used_memory"

        # Check if memory usage is high (simplified check)
        if [[ "$used_memory" =~ ([0-9]+) ]]; then
            local memory_value=${BASH_REMATCH[1]}
            if [[ $memory_value -gt 512 ]]; then
                print_status "WARNING" "$name memory usage is high: $used_memory"
            fi
        fi
    fi

    return 0
}

check_redis_replication() {
    local master_host=$1
    local master_port=$2
    local replica_count=$3

    local replication_info=$(redis-cli -h "$master_host" -p "$master_port" info replication 2>/dev/null)
    if [[ $? -ne 0 ]]; then
        print_status "ERROR" "Could not get replication info from master"
        return 1
    fi

    local connected_replicas=$(echo "$replication_info" | grep "connected_slaves:" | cut -d: -f2 | tr -d '\r')

    if [[ -n "$connected_replicas" ]]; then
        print_status "INFO" "Connected replicas: $connected_replicas/$replica_count"

        if [[ $connected_replicas -lt $replica_count ]]; then
            print_status "WARNING" "Expected $replica_count replicas, but only $connected_replicas are connected"
        fi
    else
        print_status "ERROR" "Could not determine number of connected replicas"
        return 1
    fi

    return 0
}

check_redis_latency() {
    local host=$1
    local port=$2
    local name=$3

    # Simple latency check using Redis ping
    local start_time=$(date +%s%N)
    if redis-cli -h "$host" -p "$port" ping >/dev/null 2>&1; then
        local end_time=$(date +%s%N)
        local latency_ms=$(( (end_time - start_time) / 1000000 ))

        if [[ $latency_ms -gt $CRITICAL_LATENCY_MS ]]; then
            print_status "ERROR" "$name latency is critical: ${latency_ms}ms"
            return 1
        elif [[ $latency_ms -gt $WARNING_LATENCY_MS ]]; then
            print_status "WARNING" "$name latency is high: ${latency_ms}ms"
        else
            print_status "OK" "$name latency: ${latency_ms}ms"
        fi
    else
        print_status "ERROR" "Could not measure latency for $name"
        return 1
    fi

    return 0
}

check_sentinel_status() {
    local port=$1
    local sentinel_name="sentinel-$port"

    if redis-cli -p "$port" ping >/dev/null 2>&1; then
        local master_info=$(redis-cli -p "$port" sentinel masters 2>/dev/null)
        if [[ $? -eq 0 ]] && [[ -n "$master_info" ]]; then
            print_status "OK" "$sentinel_name is operational"
            return 0
        else
            print_status "WARNING" "$sentinel_name is reachable but not configured properly"
            return 1
        fi
    else
        print_status "ERROR" "$sentinel_name is not reachable"
        return 1
    fi
}

check_service_port() {
    local port=$1
    local service_name=$2

    if nc -z localhost "$port" 2>/dev/null; then
        print_status "OK" "$service_name is running on port $port"
        return 0
    else
        print_status "ERROR" "$service_name is not accessible on port $port"
        return 1
    fi
}

check_redis_persistence() {
    local host=$1
    local port=$2
    local name=$3

    local persistence_info=$(redis-cli -h "$host" -p "$port" info persistence 2>/dev/null)
    if [[ $? -ne 0 ]]; then
        print_status "ERROR" "Could not get persistence info from $name"
        return 1
    fi

    local loading=$(echo "$persistence_info" | grep "loading:" | cut -d: -f2 | tr -d '\r')
    if [[ "$loading" == "1" ]]; then
        print_status "WARNING" "$name is currently loading data from disk"
    else
        print_status "OK" "$name persistence is normal"
    fi

    # Check AOF and RDB status
    local aof_enabled=$(echo "$persistence_info" | grep "aof_enabled:" | cut -d: -f2 | tr -d '\r')
    if [[ "$aof_enabled" == "1" ]]; then
        print_status "INFO" "$name AOF persistence is enabled"
    fi

    return 0
}

perform_master_failover_test() {
    print_status "INFO" "Performing read-only failover test (no actual failover)"

    # Check if sentinels can detect master
    local working_sentinels=0
    for port in "${SENTINEL_PORTS[@]}"; do
        if redis-cli -p "$port" sentinel masters >/dev/null 2>&1; then
            ((working_sentinels++))
        fi
    done

    if [[ $working_sentinels -ge $MIN_SENTINELS ]]; then
        print_status "OK" "Sentinel quorum is achievable ($working_sentinels/$MIN_SENTINELS)"
    else
        print_status "ERROR" "Insufficient working sentinels for quorum ($working_sentinels/$MIN_SENTINELS)"
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
    echo -e "${BLUE}Recommendations:${NC}"
    echo "- Monitor Redis memory usage and implement proper eviction policies"
    echo "- Set up automated alerts for latency and connectivity issues"
    echo "- Regularly test failover procedures in a staging environment"
    echo "- Implement proper backup and disaster recovery procedures"
    echo "- Monitor replication lag and network connectivity"

    # Exit with appropriate code
    exit $OVERALL_HEALTH
}

# Main health check execution
main() {
    print_header
    print_status "INFO" "Starting Redis cluster health check..."
    echo ""

    # Check master node
    print_status "INFO" "Checking Redis master node..."
    check_redis_connectivity "$REDIS_MASTER_HOST" "$REDIS_MASTER_PORT" "Redis Master"
    check_redis_info "$REDIS_MASTER_HOST" "$REDIS_MASTER_PORT" "Redis Master"
    check_redis_memory "$REDIS_MASTER_HOST" "$REDIS_MASTER_PORT" "Redis Master"
    check_redis_latency "$REDIS_MASTER_HOST" "$REDIS_MASTER_PORT" "Redis Master"
    check_redis_persistence "$REDIS_MASTER_HOST" "$REDIS_MASTER_PORT" "Redis Master"
    echo ""

    # Check replica nodes
    print_status "INFO" "Checking Redis replica nodes..."
    check_redis_connectivity "$REDIS_REPLICA_1_HOST" "$REDIS_REPLICA_1_PORT" "Redis Replica 1"
    check_redis_info "$REDIS_REPLICA_1_HOST" "$REDIS_REPLICA_1_PORT" "Redis Replica 1"
    check_redis_memory "$REDIS_REPLICA_1_HOST" "$REDIS_REPLICA_1_PORT" "Redis Replica 1"

    check_redis_connectivity "$REDIS_REPLICA_2_HOST" "$REDIS_REPLICA_2_PORT" "Redis Replica 2"
    check_redis_info "$REDIS_REPLICA_2_HOST" "$REDIS_REPLICA_2_PORT" "Redis Replica 2"
    check_redis_memory "$REDIS_REPLICA_2_HOST" "$REDIS_REPLICA_2_PORT" "Redis Replica 2"
    echo ""

    # Check replication
    print_status "INFO" "Checking replication status..."
    check_redis_replication "$REDIS_MASTER_HOST" "$REDIS_MASTER_PORT" $MIN_REPLICAS
    echo ""

    # Check sentinels
    print_status "INFO" "Checking Redis Sentinel nodes..."
    local working_sentinels=0
    for port in "${SENTINEL_PORTS[@]}"; do
        if check_sentinel_status $port; then
            ((working_sentinels++))
        fi
    done

    if [[ $working_sentinels -ge $MIN_SENTINELS ]]; then
        print_status "OK" "Minimum sentinel quorum available ($working_sentinels/$MIN_SENTINELS)"
    else
        print_status "ERROR" "Insufficient sentinels for quorum ($working_sentinels/$MIN_SENTINELS)"
    fi
    echo ""

    # Check auxiliary services
    print_status "INFO" "Checking auxiliary services..."
    check_service_port $REDIS_COMMANDER_PORT "Redis Commander"
    check_service_port $REDIS_EXPORTER_PORT "Redis Exporter"
    echo ""

    # Failover test
    print_status "INFO" "Checking failover capability..."
    perform_master_failover_test
    echo ""

    # Generate summary
    generate_health_report
}

# Check if required tools are available
check_dependencies() {
    local missing_tools=()

    if ! command -v redis-cli >/dev/null 2>&1; then
        missing_tools+=("redis-cli")
    fi

    if ! command -v nc >/dev/null 2>&1; then
        missing_tools+=("nc")
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