#!/bin/bash

# Questro Performance Benchmarking
# Establishes and monitors performance baselines

API_BASE="https://qestro.broad-dew-49ad.workers.dev"
RESULTS_FILE="./metrics/benchmark-results.json"
BASELINE_FILE="./metrics/performance-baseline.json"

# Benchmark tests
declare -A BENCHMARK_TESTS=(
    ["health_check"]="/health"
    ["device_list"]="/api/v1/mobile/devices"
    ["analytics"]="/api/v1/mobile/analytics/dashboard"
    ["device_farms"]="/api/v1/mobile/farms"
    ["ai_generation"]="/api/v1/mobile/ai/generate/recording"
)

run_benchmark() {
    local test_name="$1"
    local endpoint="$2"
    local iterations=10
    local total_time=0
    local success_count=0

    echo "Running benchmark: $test_name"

    for i in $(seq 1 $iterations); do
        start_time=$(date +%s%N)

        # Make the request
        if [ "$test_name" = "ai_generation" ]; then
            response=$(curl -s -X POST "$API_BASE$endpoint" \
                -H "Content-Type: application/json" \
                -d '{"recordingData": {"platform": "ios", "actions": ["tap"]}}')
        else
            response=$(curl -s "$API_BASE$endpoint")
        fi

        end_time=$(date +%s%N)
        duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

        total_time=$((total_time + duration))

        # Check if request was successful
        if echo "$response" | grep -q '"success":true\|"status":"healthy"'; then
            success_count=$((success_count + 1))
        fi

        echo "  Iteration $i: ${duration}ms"
    done

    local avg_time=$((total_time / iterations))
    local success_rate=$(( (success_count * 100) / iterations ))

    echo "  Average: ${avg_time}ms"
    echo "  Success Rate: ${success_rate}%"

    # Store result
    echo "{\"test_name\":\"$test_name\",\"endpoint\":\"$endpoint\",\"avg_response_time_ms\":$avg_time,\"success_rate_percent\":$success_rate,\"timestamp\":\"$(date -Iseconds)\",\"iterations\":$iterations}" >> "./metrics/temp-benchmark.json"
}

# Main benchmark execution
echo "Starting performance benchmarking..."

# Clear temp file
> "./metrics/temp-benchmark.json"

# Run all benchmarks
for test_name in "${!BENCHMARK_TESTS[@]}"; do
    run_benchmark "$test_name" "${BENCHMARK_TESTS[$test_name]}"
    echo ""
done

# Combine results
echo "[" > "$RESULTS_FILE"
cat "./metrics/temp-benchmark.json" | paste -sd "," - | sed 's/,$//' >> "$RESULTS_FILE"
echo "]" >> "$RESULTS_FILE"

# Clean up
rm "./metrics/temp-benchmark.json"

# Compare with baseline if it exists
if [ -f "$BASELINE_FILE" ]; then
    echo "Comparing with baseline..."
    echo "Baseline comparison results:"
    # Add baseline comparison logic here
else
    echo "Creating new baseline..."
    cp "$RESULTS_FILE" "$BASELINE_FILE"
fi

echo "Benchmarking complete. Results saved to $RESULTS_FILE"
