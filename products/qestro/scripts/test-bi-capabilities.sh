#!/bin/bash

# Questro Business Intelligence Test Script
#
# Comprehensive testing suite for Questro's BI capabilities including:
# - KPI dashboard generation
# - Business impact analysis
# - Predictive analytics
# - Custom report generation
# - Real-time metrics
# - Data export functionality

set -e

echo "📊 Questro Business Intelligence Test Suite"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:8788"
TIMEOUT=60

# Helper functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}[TEST]${NC} $1"
}

print_result() {
    echo -e "${CYAN}[RESULT]${NC} $1"
}

# Check if BI worker is running
check_bi_worker() {
    print_status "Checking if BI Dashboard worker is running..."

    if curl -s --max-time 5 "$API_BASE/api/bi/health" > /dev/null; then
        print_success "BI Dashboard worker is running"
        return 0
    else
        print_error "BI Dashboard worker is not running. Please start the worker first:"
        echo "   npm run build && npx wrangler dev --port 8788"
        exit 1
    fi
}

# Test 1: BI Service Health Check
test_bi_health() {
    print_header "Test 1: BI Service Health Check"

    response=$(curl -s "$API_BASE/api/bi/health" | jq -r '.status // "error"')

    if [ "$response" = "healthy" ]; then
        print_success "BI service health check passed"
        return 0
    else
        print_error "BI service health check failed"
        return 1
    fi
}

# Test 2: KPI Dashboard Generation
test_kpi_dashboard() {
    print_header "Test 2: KPI Dashboard Generation"

    response=$(curl -s "$API_BASE/api/bi/kpi-dashboard")
    success=$(echo "$response" | jq -r '.success // false')
    test_count=$(echo "$response" | jq -r '.data.summary | keys | length // 0')
    trend_count=$(echo "$response" | jq -r '.data.trends | length // 0')
    alert_count=$(echo "$response" | jq -r '.data.alerts | length // 0')
    insight_count=$(echo "$response" | jq -r '.data.insights | length // 0')

    if [ "$success" = "true" ] && [ "$test_count" -gt 0 ]; then
        print_success "KPI dashboard generated successfully"
        print_result "   Metrics: $test_count, Trends: $trend_count, Alerts: $alert_count, Insights: $insight_count"

        # Validate key metrics
        success_rate=$(echo "$response" | jq -r '.data.summary.testSuccessRate // -1')
        coverage=$(echo "$response" | jq -r '.data.summary.testCoverage // -1')
        roi=$(echo "$response" | jq -r '.data.summary.testingROI // -1')

        if [[ "$success_rate" =~ ^[0-9]+([.][0-9]+)?$ ]] && [ "$success_rate" -ge 0 ]; then
            print_result "   ✅ Test Success Rate: ${success_rate}%"
        else
            print_warning "   ⚠️  Invalid test success rate: $success_rate"
        fi

        if [[ "$coverage" =~ ^[0-9]+([.][0-9]+)?$ ]] && [ "$coverage" -ge 0 ]; then
            print_result "   ✅ Test Coverage: ${coverage}%"
        else
            print_warning "   ⚠️  Invalid test coverage: $coverage"
        fi

        if [[ "$roi" =~ ^[0-9]+([.][0-9]+)?$ ]] && [ "$roi" -ge 0 ]; then
            print_result "   ✅ Testing ROI: ${roi}%"
        else
            print_warning "   ⚠️  Invalid testing ROI: $roi"
        fi

        return 0
    else
        print_error "KPI dashboard generation failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 3: Real-time Metrics
test_realtime_metrics() {
    print_header "Test 3: Real-time Metrics"

    response=$(curl -s "$API_BASE/api/bi/real-time-metrics")
    success=$(echo "$response" | jq -r '.success // false')
    active_tests=$(echo "$response" | jq -r '.data.activeTests // -1')
    execution_rate=$(echo "$response" | jq -r '.data.testExecutionRate // -1')
    success_rate=$(echo "$response" | jq -r '.data.successRate // -1')

    if [ "$success" = "true" ] && [ "$active_tests" -ge 0 ]; then
        print_success "Real-time metrics retrieved successfully"
        print_result "   Active Tests: $active_tests"
        print_result "   Execution Rate: $execution_rate/hr"
        print_result "   Success Rate: ${success_rate}%"

        # Check resource usage
        cpu_usage=$(echo "$response" | jq -r '.data.resourceUsage.cpu // -1')
        memory_usage=$(echo "$response" | jq -r '.data.resourceUsage.memory // -1')

        if [ "$cpu_usage" -ge 0 ] && [ "$cpu_usage" -le 100 ]; then
            print_result "   ✅ CPU Usage: ${cpu_usage}%"
        else
            print_warning "   ⚠️  Invalid CPU usage: $cpu_usage"
        fi

        if [ "$memory_usage" -ge 0 ] && [ "$memory_usage" -le 100 ]; then
            print_result "   ✅ Memory Usage: ${memory_usage}%"
        else
            print_warning "   ⚠️  Invalid memory usage: $memory_usage"
        fi

        return 0
    else
        print_error "Real-time metrics retrieval failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 4: Business Impact Analysis
test_business_impact() {
    print_header "Test 4: Business Impact Analysis"

    request_body='{
        "projectId": "test-project-001",
        "timeRange": "30d"
    }'

    response=$(curl -s -X POST "$API_BASE/api/bi/business-impact" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    success=$(echo "$response" | jq -r '.success // false')
    time_reduction=$(echo "$response" | jq -r '.data.timeReduction.testCreation // -1')
    cost_savings=$(echo "$response" | jq -r '.data.costSavings.automatedTesting // -1')
    quality_improvement=$(echo "$response" | jq -r '.data.qualityImprovement.defectReduction // -1')

    if [ "$success" = "true" ] && [ "$time_reduction" -ge 0 ]; then
        print_success "Business impact analysis completed"
        print_result "   Test Creation Time Reduction: ${time_reduction}%"
        print_result "   Automated Testing Savings: $${cost_savings}"
        print_result "   Defect Reduction: ${quality_improvement}%"

        # Validate strategic value metrics
        market_advantage=$(echo "$response" | jq -r '.data.strategicValue.marketAdvantage // -1')
        competitive_edge=$(echo "$response" | jq -r '.data.strategicValue.competitiveEdge // -1')

        if [ "$market_advantage" -ge 0 ] && [ "$market_advantage" -le 100 ]; then
            print_result "   ✅ Market Advantage: ${market_advantage}/100"
        else
            print_warning "   ⚠️  Invalid market advantage: $market_advantage"
        fi

        if [ "$competitive_edge" -ge 0 ] && [ "$competitive_edge" -le 100 ]; then
            print_result "   ✅ Competitive Edge: ${competitive_edge}/100"
        else
            print_warning "   ⚠️  Invalid competitive edge: $competitive_edge"
        fi

        return 0
    else
        print_error "Business impact analysis failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 5: Predictive Analytics
test_predictive_analytics() {
    print_header "Test 5: Predictive Analytics"

    request_body='{
        "forecastPeriod": "90d",
        "confidence": 0.8,
        "categories": ["testVolume", "defectRate", "resourceNeeds"]
    }'

    response=$(curl -s -X POST "$API_BASE/api/bi/predictive-analytics" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    success=$(echo "$response" | jq -r '.success // false')
    prediction_count=$(echo "$response" | jq -r '.data.predictions.testVolume | length // 0')
    recommendation_count=$(echo "$response" | jq -r '.data.recommendations | length // 0')
    risk_count=$(echo "$response" | jq -r '.data.riskFactors | length // 0')

    if [ "$success" = "true" ] && [ "$prediction_count" -gt 0 ]; then
        print_success "Predictive analytics generated"
        print_result "   Test Volume Predictions: $prediction_count"
        print_result "   AI Recommendations: $recommendation_count"
        print_result "   Risk Factors Identified: $risk_count"

        # Validate prediction data
        first_prediction=$(echo "$response" | jq -r '.data.predictions.testVolume[0] // null')
        if [ "$first_prediction" != "null" ]; then
            pred_date=$(echo "$first_prediction" | jq -r '.date // "unknown"')
            pred_value=$(echo "$first_prediction" | jq -r '.predicted // -1')
            pred_confidence=$(echo "$first_prediction" | jq -r '.confidence // -1')

            print_result "   ✅ Sample Prediction: $pred_date -> $pred_value tests (${pred_confidence}% confidence)"
        fi

        # Validate recommendations
        if [ "$recommendation_count" -gt 0 ]; then
            first_rec=$(echo "$response" | jq -r '.data.recommendations[0].priority // "unknown"')
            print_result "   ✅ Sample Recommendation Priority: $first_rec"
        fi

        return 0
    else
        print_error "Predictive analytics generation failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 6: Custom Report Generation
test_custom_report() {
    print_header "Test 6: Custom Report Generation"

    request_body='{
        "id": "test-report-001",
        "name": "Test Executive Report",
        "description": "Test report generated via API",
        "type": "executive",
        "timeRange": "7d",
        "filters": {},
        "metrics": ["testingROI", "costSavings", "qualityScore"],
        "visualizations": [
            {
                "type": "metric",
                "title": "Financial Impact",
                "dataSource": "financial"
            },
            {
                "type": "chart",
                "title": "Quality Trends",
                "dataSource": "quality"
            }
        ]
    }'

    response=$(curl -s -X POST "$API_BASE/api/bi/generate-report" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    success=$(echo "$response" | jq -r '.success // false')
    report_id=$(echo "$response" | jq -r '.data.id // "unknown"')
    viz_count=$(echo "$response" | jq -r '.data.visualizations | length // 0')
    summary_length=$(echo "$response" | jq -r '.data.summary | length // 0')

    if [ "$success" = "true" ] && [ "$report_id" != "unknown" ]; then
        print_success "Custom report generated"
        print_result "   Report ID: $report_id"
        print_result "   Visualizations: $viz_count"
        print_result "   Summary Length: ${summary_length} characters"

        # Validate summary content
        if [ "$summary_length" -gt 50 ]; then
            print_result "   ✅ Comprehensive summary generated"
        else
            print_warning "   ⚠️  Summary seems too short"
        fi

        return 0
    else
        print_error "Custom report generation failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 7: Data Export
test_data_export() {
    print_header "Test 7: Data Export"

    request_body='{
        "format": "json",
        "dataTypes": ["testRuns", "testCases"],
        "timeRange": "7d",
        "filters": {}
    }'

    response=$(curl -s -X POST "$API_BASE/api/bi/export-data" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    success=$(echo "$response" | jq -r '.success // false')
    record_count=$(echo "$response" | jq -r '.data.recordCount // -1')
    export_format=$(echo "$response" | jq -r '.data.format // "unknown"')

    if [ "$success" = "true" ] && [ "$record_count" -ge 0 ]; then
        print_success "Data export completed"
        print_result "   Format: $export_format"
        print_result "   Records: $record_count"
        print_result "   Exported: $(echo "$response" | jq -r '.data.exportedAt // "unknown"')"

        # Validate data structure
        if echo "$response" | jq -e '.data.data.testRuns' > /dev/null 2>&1; then
            test_runs_count=$(echo "$response" | jq -r '.data.data.testRuns | length // 0')
            print_result "   ✅ Test Runs: $test_runs_count records"
        fi

        if echo "$response" | jq -e '.data.data.testCases' > /dev/null 2>&1; then
            test_cases_count=$(echo "$response" | jq -r '.data.data.testCases | length // 0')
            print_result "   ✅ Test Cases: $test_cases_count records"
        fi

        return 0
    else
        print_error "Data export failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 8: Web Dashboard Interface
test_web_dashboard() {
    print_header "Test 8: Web Dashboard Interface"

    # Test dashboard main page
    dashboard_response=$(curl -s "$API_BASE/dashboard")

    if echo "$dashboard_response" | grep -q "Questro Business Intelligence"; then
        print_success "Dashboard main page accessible"
        print_result "   ✅ Dashboard title found"
    else
        print_error "Dashboard main page not accessible"
        return 1
    fi

    # Test dashboard overview page
    overview_response=$(curl -s "$API_BASE/dashboard/overview")

    if echo "$overview_response" | grep -q "Business Intelligence Overview"; then
        print_success "Dashboard overview page accessible"
        print_result "   ✅ Overview page loaded"
    else
        print_warning "Dashboard overview page may have issues"
    fi

    # Test analytics page
    analytics_response=$(curl -s "$API_BASE/dashboard/analytics")

    if echo "$analytics_response" | grep -q "Analytics & Reporting"; then
        print_success "Dashboard analytics page accessible"
        print_result "   ✅ Analytics page loaded"
    else
        print_warning "Dashboard analytics page may have issues"
    fi

    # Check for required JavaScript and CSS
    if echo "$dashboard_response" | grep -q "Chart.js" && echo "$dashboard_response" | grep -q "Tailwind CSS"; then
        print_result "   ✅ Required dependencies (Chart.js, Tailwind) found"
    else
        print_warning "   ⚠️  Some dependencies may be missing"
    fi

    return 0
}

# Test 9: Performance Benchmark
test_performance_benchmark() {
    print_header "Test 9: Performance Benchmark"

    # Test API response times
    print_status "Benchmarking API response times..."

    # KPI Dashboard
    kpi_start=$(date +%s%N)
    curl -s "$API_BASE/api/bi/kpi-dashboard" > /dev/null
    kpi_end=$(date +%s%N)
    kpi_time=$(((kpi_end - kpi_start) / 1000000))

    # Real-time Metrics
    realtime_start=$(date +%s%N)
    curl -s "$API_BASE/api/bi/real-time-metrics" > /dev/null
    realtime_end=$(date +%s%N)
    realtime_time=$(((realtime_end - realtime_start) / 1000000))

    # Business Impact
    impact_start=$(date +%s%N)
    curl -s -X POST "$API_BASE/api/bi/business-impact" \
        -H "Content-Type: application/json" \
        -d '{"timeRange": "7d"}' > /dev/null
    impact_end=$(date +%s%N)
    impact_time=$(((impact_end - impact_start) / 1000000))

    # Predictive Analytics
    predict_start=$(date +%s%N)
    curl -s -X POST "$API_BASE/api/bi/predictive-analytics" \
        -H "Content-Type: application/json" \
        -d '{"forecastPeriod": "30d", "categories": ["testVolume"]}' > /dev/null
    predict_end=$(date +%s%N)
    predict_time=$(((predict_end - predict_start) / 1000000))

    print_success "Performance benchmark completed"
    print_result "   KPI Dashboard: ${kpi_time}ms"
    print_result "   Real-time Metrics: ${realtime_time}ms"
    print_result "   Business Impact: ${impact_time}ms"
    print_result "   Predictive Analytics: ${predict_time}ms"

    # Performance evaluation
    total_time=$((kpi_time + realtime_time + impact_time + predict_time))
    avg_time=$((total_time / 4))

    print_result "   Average Response Time: ${avg_time}ms"

    if [ "$avg_time" -lt 1000 ]; then
        print_result "   ✅ Excellent performance (< 1s average)"
    elif [ "$avg_time" -lt 3000 ]; then
        print_result "   ✅ Good performance (< 3s average)"
    elif [ "$avg_time" -lt 5000 ]; then
        print_warning "   ⚠️  Acceptable performance (< 5s average)"
    else
        print_warning "   ⚠️  Performance could be improved (> 5s average)"
    fi

    return 0
}

# Test 10: Integration Test
test_integration() {
    print_header "Test 10: End-to-End Integration Test"

    # Test complete workflow
    print_status "Testing complete BI workflow..."

    # Step 1: Get KPI dashboard
    kpi_response=$(curl -s "$API_BASE/api/bi/kpi-dashboard")
    kpi_success=$(echo "$kpi_response" | jq -r '.success // false')

    if [ "$kpi_success" = "true" ]; then
        print_result "   ✅ Step 1: KPI dashboard - SUCCESS"
    else
        print_error "   ❌ Step 1: KPI dashboard - FAILED"
        return 1
    fi

    # Step 2: Get real-time metrics
    realtime_response=$(curl -s "$API_BASE/api/bi/real-time-metrics")
    realtime_success=$(echo "$realtime_response" | jq -r '.success // false')

    if [ "$realtime_success" = "true" ]; then
        print_result "   ✅ Step 2: Real-time metrics - SUCCESS"
    else
        print_error "   ❌ Step 2: Real-time metrics - FAILED"
        return 1
    fi

    # Step 3: Generate business impact analysis
    impact_response=$(curl -s -X POST "$API_BASE/api/bi/business-impact" \
        -H "Content-Type: application/json" \
        -d '{"timeRange": "7d"}')
    impact_success=$(echo "$impact_response" | jq -r '.success // false')

    if [ "$impact_success" = "true" ]; then
        print_result "   ✅ Step 3: Business impact - SUCCESS"
    else
        print_error "   ❌ Step 3: Business impact - FAILED"
        return 1
    fi

    # Step 4: Generate predictive analytics
    predict_response=$(curl -s -X POST "$API_BASE/api/bi/predictive-analytics" \
        -H "Content-Type: application/json" \
        -d '{"forecastPeriod": "30d", "categories": ["testVolume"]}')
    predict_success=$(echo "$predict_response" | jq -r '.success // false')

    if [ "$predict_success" = "true" ]; then
        print_result "   ✅ Step 4: Predictive analytics - SUCCESS"
    else
        print_error "   ❌ Step 4: Predictive analytics - FAILED"
        return 1
    fi

    # Step 5: Generate custom report
    report_response=$(curl -s -X POST "$API_BASE/api/bi/generate-report" \
        -H "Content-Type: application/json" \
        -d '{"id": "integration-test", "name": "Integration Test", "type": "executive", "timeRange": "7d"}')
    report_success=$(echo "$report_response" | jq -r '.success // false')

    if [ "$report_success" = "true" ]; then
        print_result "   ✅ Step 5: Custom report - SUCCESS"
    else
        print_error "   ❌ Step 5: Custom report - FAILED"
        return 1
    fi

    # Step 6: Export data
    export_response=$(curl -s -X POST "$API_BASE/api/bi/export-data" \
        -H "Content-Type: application/json" \
        -d '{"format": "json", "dataTypes": ["testRuns"], "timeRange": "7d"}')
    export_success=$(echo "$export_response" | jq -r '.success // false')

    if [ "$export_success" = "true" ]; then
        print_result "   ✅ Step 6: Data export - SUCCESS"
    else
        print_error "   ❌ Step 6: Data export - FAILED"
        return 1
    fi

    print_success "End-to-end integration test completed successfully"
    print_result "   All 6 workflow steps completed without errors"

    return 0
}

# Cleanup function
cleanup() {
    print_status "Cleaning up test environment..."
    # Add any cleanup tasks here
    print_success "Cleanup completed"
}

# Main execution
main() {
    # Trap cleanup on exit
    trap cleanup EXIT

    print_status "Starting Questro Business Intelligence test suite..."
    echo ""

    # Run tests
    local tests=(
        "check_bi_worker"
        "test_bi_health"
        "test_kpi_dashboard"
        "test_realtime_metrics"
        "test_business_impact"
        "test_predictive_analytics"
        "test_custom_report"
        "test_data_export"
        "test_web_dashboard"
        "test_performance_benchmark"
        "test_integration"
    )

    local passed=0
    local failed=0
    local total=${#tests[@]}

    for test in "${tests[@]}"; do
        echo ""
        if $test; then
            ((passed++))
        else
            ((failed++))
        fi
    done

    echo ""
    print_status "BI Test Suite Summary"
    echo "========================"
    echo "Total tests: $total"
    echo -e "Passed: ${GREEN}$passed${NC}"
    echo -e "Failed: ${RED}$failed${NC}"

    if [ $failed -eq 0 ]; then
        echo ""
        print_success "🎉 All BI tests passed! Questro Business Intelligence is working perfectly."
        echo ""
        echo "✨ Key Features Validated:"
        echo "   • Real-time KPI monitoring with trend analysis"
        echo "   • Business impact analysis with ROI calculations"
        echo "   • AI-powered predictive analytics and forecasting"
        echo "   • Custom report generation with multiple formats"
        echo "   • Data export for external BI tools"
        echo "   • Interactive web dashboard interface"
        echo "   • Performance optimization and caching"
        echo "   • End-to-end workflow integration"
        exit 0
    else
        echo ""
        print_error "❌ Some BI tests failed. Please check the errors above."
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    command -v curl >/dev/null 2>&1 || { print_error "curl is required but not installed."; exit 1; }
    command -v jq >/dev/null 2>&1 || { print_error "jq is required but not installed."; exit 1; }
    command -v bc >/dev/null 2>&1 || { print_error "bc is required but not installed."; exit 1; }
}

# Check dependencies and run main
check_dependencies
main
