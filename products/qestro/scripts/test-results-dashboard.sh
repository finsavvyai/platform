#!/bin/bash
# test-results-dashboard.sh
# Visual dashboard for E2E test results

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  🎯 QUESTRO E2E TEST DASHBOARD                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

print_section() {
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_stat() {
    local label=$1
    local value=$2
    local color=$3
    printf "${BOLD}%-25s${NC} ${color}%s${NC}\n" "$label:" "$value"
}

print_bar() {
    local percentage=$1
    local color=$2
    local bar_length=40
    local filled=$((percentage * bar_length / 100))
    local empty=$((bar_length - filled))

    printf "${color}"
    printf '█%.0s' $(seq 1 $filled)
    printf "${NC}"
    printf '░%.0s' $(seq 1 $empty)
    printf " ${BOLD}${percentage}%%${NC}\n"
}

# Check if test results exist
RESULTS_DIR="test-results"
REPORT_DIR="playwright-report"
PLAYWRIGHT_JSON="playwright-results.json"

if [ ! -d "$RESULTS_DIR" ] && [ ! -d "$REPORT_DIR" ]; then
    echo -e "${YELLOW}⚠  No test results found${NC}"
    echo ""
    echo "Run tests first:"
    echo "  npm run test:e2e"
    echo ""
    exit 1
fi

# Parse test results from Playwright output
print_section "📊 TEST SUITE OVERVIEW"

echo "Test Suites:"
echo ""

# Count test files
AUTH_TESTS=$(find tests/e2e/auth -name "*.spec.ts" 2>/dev/null | wc -l | xargs)
DASHBOARD_TESTS=$(find tests/e2e/dashboard -name "*.spec.ts" 2>/dev/null | wc -l | xargs)
PROJECTS_TESTS=$(find tests/e2e/projects -name "*.spec.ts" 2>/dev/null | wc -l | xargs)
TOTAL_FILES=$((AUTH_TESTS + DASHBOARD_TESTS + PROJECTS_TESTS))

printf "  ${CYAN}●${NC} Authentication      %2d test file(s)\n" "$AUTH_TESTS"
printf "  ${CYAN}●${NC} Dashboard           %2d test file(s)\n" "$DASHBOARD_TESTS"
printf "  ${CYAN}●${NC} Project Management  %2d test file(s)\n" "$PROJECTS_TESTS"
echo ""
printf "${BOLD}Total Test Files:${NC} %d\n" "$TOTAL_FILES"
echo ""

# Parse Playwright JSON summary when available
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
FLAKY_TESTS=0

if [ -f "$PLAYWRIGHT_JSON" ]; then
    read TOTAL_TESTS PASSED_TESTS FAILED_TESTS SKIPPED_TESTS FLAKY_TESTS < <(
        node -e '
            const fs = require("fs");
            const file = process.argv[1];
            const stats = { tests: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 };
            const testStatus = new Set(["passed", "failed", "timedOut", "interrupted", "skipped", "flaky"]);
            function walkSuite(suite) {
                (suite.specs || []).forEach((spec) => {
                    (spec.tests || []).forEach((test) => {
                        const first = (test.results || [])[0];
                        if (first && testStatus.has(first.status)) {
                            stats.tests += 1;
                            if (first.status === "passed") stats.passed += 1;
                            else if (first.status === "failed" || first.status === "timedOut" || first.status === "interrupted") stats.failed += 1;
                            else if (first.status === "skipped") stats.skipped += 1;
                            else if (first.status === "flaky") stats.flaky += 1;
                        }
                    });
                });
                (suite.suites || []).forEach(walkSuite);
            }
            const json = JSON.parse(fs.readFileSync(file, "utf8"));
            (json.suites || []).forEach(walkSuite);
            console.log([stats.tests, stats.passed, stats.failed, stats.skipped, stats.flaky].join(" "));
        ' "$PLAYWRIGHT_JSON"
    )
fi

print_section "📈 TEST COVERAGE"

if [ "$TOTAL_TESTS" -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

    echo "Latest Playwright Run:"
    echo ""
    print_stat "  Total Tests" "$TOTAL_TESTS" "${CYAN}"
    print_stat "  Passed" "$PASSED_TESTS" "${GREEN}"
    print_stat "  Failed" "$FAILED_TESTS" "${RED}"
    print_stat "  Skipped" "$SKIPPED_TESTS" "${YELLOW}"
    print_stat "  Flaky" "$FLAKY_TESTS" "${MAGENTA}"
    echo ""
    printf "  ${BOLD}Pass Rate:${NC}             "
    print_bar "$PASS_RATE" "${GREEN}"
    echo ""
else
    echo -e "${YELLOW}No parseable Playwright JSON found (${PLAYWRIGHT_JSON}).${NC}"
    echo "Run: npm run test:e2e"
    echo ""
fi

print_section "🎯 CRITICAL USER FLOWS"

print_flow() {
    local flow=$1
    local status=$2
    local icon=$3
    local color=$4

    printf "  ${color}${icon}${NC} ${BOLD}%-30s${NC} ${color}%s${NC}\n" "$flow" "$status"
}
flow_status() {
    local pattern=$1
    local label=$2
    local count
    count=$(find tests/e2e -name "*.spec.ts" 2>/dev/null | rg -c "$pattern" || true)
    if [ "${count:-0}" -gt 0 ]; then
        print_flow "$label" "✓ Covered (${count} test file(s))" "✓" "${GREEN}"
        return 1
    fi
    print_flow "$label" "✗ Not covered" "✗" "${RED}"
    return 0
}

echo "Status of critical business flows:"
echo ""
COVERED=0
TOTAL_FLOWS=9
flow_status "tests/e2e/auth|login" "User Login" || COVERED=$((COVERED + 1))
flow_status "tests/e2e/dashboard|dashboard" "Dashboard Access" || COVERED=$((COVERED + 1))
flow_status "tests/e2e/projects/03-project-creation|project-creation" "Project Creation" || COVERED=$((COVERED + 1))
flow_status "tests/e2e/projects/04-project-management|project-management" "Project Management" || COVERED=$((COVERED + 1))
flow_status "recording" "Test Recording" || COVERED=$((COVERED + 1))
flow_status "execution|runs" "Test Execution" || COVERED=$((COVERED + 1))
flow_status "ai|testgen|testquality" "AI Test Generation" || COVERED=$((COVERED + 1))
flow_status "team|collaboration" "Team Collaboration" || COVERED=$((COVERED + 1))
flow_status "api" "API Testing" || COVERED=$((COVERED + 1))
echo ""

CRITICAL_COVERAGE=$((COVERED * 100 / TOTAL_FLOWS))
printf "${BOLD}Critical Flows Coverage:${NC} "
print_bar $CRITICAL_COVERAGE "${GREEN}"
echo ""

print_section "🌐 BROWSER SUPPORT"

echo "Multi-browser testing configuration:"
echo ""
printf "  ${CYAN}●${NC} Chromium   (Chrome, Edge, Brave)\n"
printf "  ${CYAN}●${NC} Firefox    (Mozilla Firefox)\n"
printf "  ${CYAN}●${NC} WebKit     (Safari)\n"
printf "  ${CYAN}●${NC} Mobile     (Mobile viewports)\n"
echo ""

print_section "📁 TEST ARTIFACTS"

echo "Recent test artifacts:"
echo ""

# Check for recent test results
if [ -d "$RESULTS_DIR" ]; then
    RESULT_COUNT=$(find "$RESULTS_DIR" -type f 2>/dev/null | wc -l | xargs)
    SCREENSHOT_COUNT=$(find "$RESULTS_DIR" -name "*.png" 2>/dev/null | wc -l | xargs)
    VIDEO_COUNT=$(find "$RESULTS_DIR" -name "*.webm" 2>/dev/null | wc -l | xargs)

    print_stat "  Test Results" "$RESULT_COUNT files" "${CYAN}"
    print_stat "  Screenshots" "$SCREENSHOT_COUNT images" "${CYAN}"
    print_stat "  Videos" "$VIDEO_COUNT recordings" "${CYAN}"
else
    echo "  No test artifacts found"
fi
echo ""

# Check for HTML report
if [ -d "$REPORT_DIR" ]; then
    REPORT_SIZE=$(du -sh "$REPORT_DIR" 2>/dev/null | cut -f1)
    print_stat "  HTML Report" "$REPORT_SIZE" "${GREEN}"
    echo ""
    echo -e "  ${GREEN}✓${NC} View report: ${BOLD}npm run test:e2e:report${NC}"
else
    echo "  No HTML report generated yet"
    echo ""
    echo -e "  ${YELLOW}ℹ${NC} Generate report: ${BOLD}npm run test:e2e${NC}"
fi
echo ""

print_section "⚡ QUICK ACTIONS"

echo "Common testing commands:"
echo ""
echo -e "  ${BOLD}npm run test:e2e${NC}"
echo "    Run all E2E tests"
echo ""
echo -e "  ${BOLD}npm run test:e2e:ui${NC}"
echo "    Interactive test UI (recommended for development)"
echo ""
echo -e "  ${BOLD}npm run test:e2e:smoke${NC}"
echo "    Run critical path tests only (~2 min)"
echo ""
echo -e "  ${BOLD}npm run test:e2e:report${NC}"
echo "    View detailed HTML report"
echo ""
echo -e "  ${BOLD}npm run test:e2e:debug${NC}"
echo "    Debug mode with breakpoints"
echo ""

print_section "🎯 NEXT STEPS"

echo "Suggested testing priorities:"
echo ""
echo -e "  ${YELLOW}1.${NC} ${BOLD}Test Recording Workflows${NC}"
echo "     Add tests for recording mobile and web tests"
echo ""
echo -e "  ${YELLOW}2.${NC} ${BOLD}Test Execution${NC}"
echo "     Verify test execution and result reporting"
echo ""
echo -e "  ${YELLOW}3.${NC} ${BOLD}AI Features${NC}"
echo "     Test AI-powered test generation and insights"
echo ""
echo -e "  ${YELLOW}4.${NC} ${BOLD}API Management${NC}"
echo "     Cover API testing and management features"
echo ""
echo -e "  ${YELLOW}5.${NC} ${BOLD}Team Collaboration${NC}"
echo "     Test team invites, roles, and permissions"
echo ""

print_section "📚 DOCUMENTATION"

echo "Available documentation:"
echo ""
echo -e "  ${CYAN}●${NC} Quick Start:         ${BOLD}E2E_TESTING_QUICK_START.md${NC}"
echo -e "  ${CYAN}●${NC} Complete Guide:      ${BOLD}TESTING_COMPLETE_GUIDE.md${NC}"
echo -e "  ${CYAN}●${NC} Implementation:      ${BOLD}E2E_TESTING_PHASE2_COMPLETE.md${NC}"
echo -e "  ${CYAN}●${NC} Test Organization:   ${BOLD}tests/e2e/README.md${NC}"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     Dashboard Updated $(date +%Y-%m-%d)                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
