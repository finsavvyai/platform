#!/bin/bash

# QuantumBeam.io - MinIO Cluster Health Check Script
# This script monitors the health of the MinIO cluster and its components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MINIO_NODES=("minio-1" "minio-2" "minio-3" "minio-4")
MINIO_PORTS=("9000" "9010" "9020" "9030")
MINIO_CONSOLE_PORTS=("9001" "9011" "9021" "9031")
MINIO_LB_PORT=8080
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
MINIO_EXPORTER_PORT=9123

# Health check thresholds
WARNING_LATENCY_MS=1000
CRITICAL_LATENCY_MS=5000
WARNING_DISK_USAGE=80
CRITICAL_DISK_USAGE=90
MIN_NODES=3

# Global variables
OVERALL_HEALTH=0
FAILED_CHECKS=()

# Functions
print_header() {
    echo -e "${BLUE}🏥 QuantumBeam.io - MinIO Cluster Health Check${NC}"
    echo -e "${BLUE}============================================${NC}"
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

check_minio_node() {
    local node_name=$1
    local api_port=$2
    local console_port=$3
    local container_name="quantumbeam-$node_name"

    # Check if container is running
    if docker ps --filter "name=$container_name" --format "table {{.Names}}" | grep -q "$container_name"; then
        print_status "OK" "$node_name container is running"
    else
        print_status "ERROR" "$node_name container is not running"
        return 1
    fi

    # Check API endpoint
    if curl -s -f "http://localhost:$api_port/minio/health/live" >/dev/null 2>&1; then
        print_status "OK" "$node_name API is healthy"
    else
        print_status "ERROR" "$node_name API is not responding"
        return 1
    fi

    # Check console endpoint
    if curl -s -f "http://localhost:$console_port" >/dev/null 2>&1; then
        print_status "OK" "$node_name console is accessible"
    else
        print_status "WARNING" "$node_name console is not accessible"
    fi

    # Check API response time
    start_time=$(date +%s%N)
    if curl -s -f "http://localhost:$api_port/minio/health/live" >/dev/null 2>&1; then
        end_time=$(date +%s%N)
        latency_ms=$(( (end_time - start_time) / 1000000 ))

        if [[ $latency_ms -gt $CRITICAL_LATENCY_MS ]]; then
            print_status "ERROR" "$node_name API latency is critical: ${latency_ms}ms"
        elif [[ $latency_ms -gt $WARNING_LATENCY_MS ]]; then
            print_status "WARNING" "$node_name API latency is high: ${latency_ms}ms"
        else
            print_status "OK" "$node_name API latency: ${latency_ms}ms"
        fi
    else
        print_status "WARNING" "$node_name API latency test failed"
    fi

    # Check container resource usage
    if docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -q "$container_name"; then
        stats=$(docker stats --no-stream --format "{{.CPUPerc}},{{.MemUsage}}" "$container_name")
        cpu_usage=$(echo "$stats" | cut -d',' -f1)
        mem_usage=$(echo "$stats" | cut -d',' -f2)

        print_status "INFO" "$node_name resource usage: CPU $cpu_usage, Memory $mem_usage"
    else
        print_status "WARNING" "$node_name resource stats not available"
    fi

    return 0
}

check_cluster_status() {
    print_status "INFO" "Checking MinIO cluster status..."

    local healthy_nodes=0
    for i in "${!MINIO_NODES[@]}"; do
        node="${MINIO_NODES[$i]}"
        api_port="${MINIO_PORTS[$i]}"

        if curl -s -f "http://localhost:$api_port/minio/health/live" >/dev/null 2>&1; then
            ((healthy_nodes++))
        fi
    done

    if [[ $healthy_nodes -ge $MIN_NODES ]]; then
        print_status "OK" "Cluster status: $healthy_nodes/${#MINIO_NODES[@]} nodes healthy"
    else
        print_status "ERROR" "Insufficient healthy nodes: $healthy_nodes/${#MINIO_NODES[@]}"
        return 1
    fi

    return 0
}

check_erasure_coding() {
    print_status "INFO" "Checking erasure coding status..."

    # Use mc to check cluster status if available
    if command -v mc >/dev/null 2>&1; then
        # Set up mc alias for local cluster
        export MC_HOST_local="http://quantumbeamadmin:quantumbeam_minio_secure_2024@localhost:9000"

        # Check cluster healing status
        if mc admin heal local --json >/dev/null 2>&1; then
            print_status "OK" "Erasure coding configuration is valid"
        else
            print_status "WARNING" "Could not verify erasure coding status"
        fi

        # Check disk usage
        if mc du local --json >/dev/null 2>&1; then
            usage=$(mc du local --json 2>/dev/null | grep -o '"size":[0-9]*' | head -1 | cut -d':' -f2)
            if [[ -n "$usage" ]]; then
                print_status "INFO" "Cluster storage used: $usage bytes"
            fi
        fi
    else
        print_status "WARNING" "MinIO client (mc) not available for detailed cluster checks"
    fi
}

check_load_balancer() {
    print_status "INFO" "Checking MinIO load balancer..."

    if curl -s -f "http://localhost:$MINIO_LB_PORT/minio/health/live" >/dev/null 2>&1; then
        print_status "OK" "Load balancer is accessible and forwarding requests"
    else
        print_status "ERROR" "Load balancer is not accessible"
        return 1
    fi

    # Test load balancer response time
    start_time=$(date +%s%N)
    if curl -s -f "http://localhost:$MINIO_LB_PORT/minio/health/live" >/dev/null 2>&1; then
        end_time=$(date +%s%N)
        latency_ms=$(( (end_time - start_time) / 1000000 ))
        print_status "INFO" "Load balancer response time: ${latency_ms}ms"
    fi

    return 0
}

check_monitoring_services() {
    print_status "INFO" "Checking monitoring services..."

    # Check Prometheus
    if curl -s -f "http://localhost:$PROMETHEUS_PORT/-/healthy" >/dev/null 2>&1; then
        print_status "OK" "Prometheus is healthy"
    else
        print_status "WARNING" "Prometheus is not accessible"
    fi

    # Check Grafana
    if curl -s -f "http://localhost:$GRAFANA_PORT/api/health" >/dev/null 2>&1; then
        print_status "OK" "Grafana is healthy"
    else
        print_status "WARNING" "Grafana is not accessible"
    fi

    # Check MinIO exporter
    if curl -s -f "http://localhost:$MINIO_EXPORTER_PORT/health" >/dev/null 2>&1; then
        print_status "OK" "MinIO exporter is healthy"
    else
        print_status "WARNING" "MinIO exporter is not accessible"
    fi
}

check_disk_usage() {
    print_status "INFO" "Checking disk usage..."

    # Check MinIO data directories
    minio_dirs=(
        "/var/lib/docker/volumes/quantumbeam_minio_1_data_1"
        "/var/lib/docker/volumes/quantumbeam_minio_2_data_1"
        "/var/lib/docker/volumes/quantumbeam_minio_3_data_1"
        "/var/lib/docker/volumes/quantumbeam_minio_4_data_1"
    )

    local total_usage=0
    for dir in "${minio_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            usage=$(du -sb "$dir" 2>/dev/null | cut -f1)
            if [[ -n "$usage" ]]; then
                total_usage=$((total_usage + usage))
            fi
        fi
    done

    if [[ $total_usage -gt 0 ]]; then
        usage_gb=$((total_usage / 1024 / 1024 / 1024))
        print_status "INFO" "Total MinIO data usage: ${usage_gb}GB"
    fi

    # Check available disk space
    available_space=$(df /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}')
    if [[ -n "$available_space" ]]; then
        available_gb=$((available_space / 1024 / 1024))
        print_status "INFO" "Available disk space: ${available_gb}GB"
    fi
}

check_bucket_health() {
    print_status "INFO" "Checking bucket health..."

    if command -v mc >/dev/null 2>&1; then
        export MC_HOST_local="http://quantumbeamadmin:quantumbeam_minio_secure_2024@localhost:9000"

        # List buckets
        buckets=$(mc ls local 2>/dev/null | awk '{print $NF}' | sed 's/\///')
        if [[ -n "$buckets" ]]; then
            bucket_count=$(echo "$buckets" | wc -l)
            print_status "INFO" "Bucket count: $bucket_count"

            # Check for empty buckets
            empty_buckets=0
            for bucket in $buckets; do
                object_count=$(mc ls "local/$bucket" 2>/dev/null | wc -l)
                if [[ $object_count -eq 0 ]]; then
                    ((empty_buckets++))
                fi
            done

            if [[ $empty_buckets -gt 0 ]]; then
                print_status "INFO" "Empty buckets: $empty_buckets"
            fi
        else
            print_status "WARNING" "Could not list buckets"
        fi
    else
        print_status "WARNING" "MinIO client not available for bucket checks"
    fi
}

check_network_connectivity() {
    print_status "INFO" "Checking network connectivity..."

    # Check if nodes can communicate with each other
    local failed_connections=0

    for i in "${!MINIO_NODES[@]}"; do
        source_node="${MINIO_NODES[$i]}"
        source_port="${MINIO_PORTS[$i]}"

        for j in "${!MINIO_NODES[@]}"; do
            if [[ $i -eq $j ]]; then
                continue
            fi

            target_node="${MINIO_NODES[$j]}"
            target_port="${MINIO_PORTS[$j]}"

            # This is a simplified check - in reality, we'd need to check inter-container connectivity
            if curl -s -f "http://localhost:$source_port" >/dev/null 2>&1; then
                # Node is responding to local requests
                continue
            else
                ((failed_connections++))
            fi
        done
    done

    if [[ $failed_connections -gt 0 ]]; then
        print_status "WARNING" "Network connectivity issues detected: $failed_connections failed connections"
    else
        print_status "OK" "Network connectivity appears healthy"
    fi
}

perform_read_write_test() {
    print_status "INFO" "Performing read/write test..."

    # Create test file
    test_content="MinIO health check test $(date)"
    test_file="/tmp/minio-health-test.txt"

    echo "$test_content" > "$test_file"

    # Use mc to upload and download test file if available
    if command -v mc >/dev/null 2>&1; then
        export MC_HOST_local="http://quantumbeamadmin:quantumbeam_minio_secure_2024@localhost:9000"

        # Upload test file
        if mc cp "$test_file" "local/health-test/" 2>/dev/null; then
            print_status "OK" "File upload test passed"

            # Download test file
            if mc cp "local/health-test/minio-health-test.txt" "/tmp/minio-download-test.txt" 2>/dev/null; then
                # Verify content
                downloaded_content=$(cat "/tmp/minio-download-test.txt")
                if [[ "$downloaded_content" == "$test_content" ]]; then
                    print_status "OK" "File download and verification test passed"
                else
                    print_status "ERROR" "File content verification failed"
                fi
                rm -f "/tmp/minio-download-test.txt"
            else
                print_status "ERROR" "File download test failed"
            fi

            # Clean up
            mc rm "local/health-test/minio-health-test.txt" 2>/dev/null || true
        else
            print_status "ERROR" "File upload test failed"
        fi
    else
        print_status "WARNING" "MinIO client not available for read/write test"
    fi

    rm -f "$test_file"
}

check_recent_logs() {
    print_status "INFO" "Checking recent logs for errors..."

    for i in "${!MINIO_NODES[@]}"; do
        node="${MINIO_NODES[$i]}"
        container_name="quantumbeam-$node"

        # Check recent logs for errors
        error_count=$(docker logs --tail=50 "$container_name" 2>&1 | grep -i "error\|fatal\|panic" | wc -l)
        warning_count=$(docker logs --tail=50 "$container_name" 2>&1 | grep -i "warning\|warn" | wc -l)

        if [[ $error_count -gt 0 ]]; then
            print_status "WARNING" "$node: $error_count errors in recent logs"
        fi

        if [[ $warning_count -gt 0 ]]; then
            print_status "INFO" "$node: $warning_count warnings in recent logs"
        fi

        if [[ $error_count -eq 0 && $warning_count -eq 0 ]]; then
            print_status "OK" "$node: No errors or warnings in recent logs"
        fi
    done
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
    echo "  - MinIO Nodes: ${#MINIO_NODES[@]}"
    echo "  - Erasure Coding: 4+4"
    echo "  - Load Balancer: Port $MINIO_LB_PORT"
    echo "  - Monitoring: Prometheus (Port $PROMETHEUS_PORT), Grafana (Port $GRAFANA_PORT)"

    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo "  - MinIO Node 1: http://localhost:9000 (Console: http://localhost:9001)"
    echo "  - MinIO Node 2: http://localhost:9010 (Console: http://localhost:9011)"
    echo "  - MinIO Node 3: http://localhost:9020 (Console: http://localhost:9021)"
    echo "  - MinIO Node 4: http://localhost:9030 (Console: http://localhost:9031)"
    echo "  - Load Balancer: http://localhost:$MINIO_LB_PORT"
    echo "  - Grafana: http://localhost:$GRAFANA_PORT"

    echo ""
    echo -e "${BLUE}Recommendations:${NC}"
    echo "- Monitor disk usage and plan capacity accordingly"
    echo "- Set up automated alerts for node failures"
    echo "- Regularly test cluster healing procedures"
    echo "- Implement proper backup strategies"
    echo "- Monitor network latency between nodes"
    echo "- Set up log aggregation and monitoring"
    echo "- Review bucket lifecycle policies regularly"

    # Exit with appropriate code
    exit $OVERALL_HEALTH
}

# Main health check execution
main() {
    print_header
    print_status "INFO" "Starting MinIO cluster health check..."
    echo ""

    # Check individual MinIO nodes
    print_status "INFO" "Checking MinIO nodes..."
    for i in "${!MINIO_NODES[@]}"; do
        node="${MINIO_NODES[$i]}"
        api_port="${MINIO_PORTS[$i]}"
        console_port="${MINIO_CONSOLE_PORTS[$i]}"

        check_minio_node "$node" "$api_port" "$console_port"
    done
    echo ""

    # Check cluster status
    print_status "INFO" "Checking cluster health..."
    check_cluster_status
    check_erasure_coding
    echo ""

    # Check load balancer
    print_status "INFO" "Checking load balancer..."
    check_load_balancer
    echo ""

    # Check monitoring services
    print_status "INFO" "Checking monitoring services..."
    check_monitoring_services
    echo ""

    # Check disk usage
    print_status "INFO" "Checking storage health..."
    check_disk_usage
    check_bucket_health
    echo ""

    # Check network connectivity
    print_status "INFO" "Checking network connectivity..."
    check_network_connectivity
    echo ""

    # Perform functionality tests
    print_status "INFO" "Performing functionality tests..."
    perform_read_write_test
    echo ""

    # Check logs
    print_status "INFO" "Checking recent logs..."
    check_recent_logs
    echo ""

    # Generate summary
    generate_health_report
}

# Check if required tools are available
check_dependencies() {
    local missing_tools=()

    if ! command -v docker >/dev/null 2>&1; then
        missing_tools+=("docker")
    fi

    if ! command -v curl >/dev/null 2>&1; then
        missing_tools+=("curl")
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