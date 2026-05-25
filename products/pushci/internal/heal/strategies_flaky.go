package heal

import (
	"regexp"
	"strings"
)

var reTestName = regexp.MustCompile(`--- FAIL: (\S+)`)
var reJestFail = regexp.MustCompile(`FAIL\s+(\S+\.(?:test|spec)\.\w+)`)
var rePyFail = regexp.MustCompile(`FAILED\s+(\S+::?\S+)`)

// flakyTest detects and isolates flaky test failures.
func flakyTest(output string) *Fix {
	name := extractFailingTest(output)
	if name == "" {
		return nil
	}
	if !isFlakyIndicator(output) {
		return nil
	}
	return &Fix{
		Pattern: "flaky-test",
		Action:  buildFlakyCommand(name, output),
	}
}

func extractFailingTest(output string) string {
	if m := reTestName.FindStringSubmatch(output); len(m) > 1 {
		return m[1]
	}
	if m := reJestFail.FindStringSubmatch(output); len(m) > 1 {
		return m[1]
	}
	if m := rePyFail.FindStringSubmatch(output); len(m) > 1 {
		return m[1]
	}
	return ""
}

func isFlakyIndicator(output string) bool {
	indicators := []string{
		"timeout", "timed out", "flaky", "intermittent",
		"race condition", "deadline exceeded",
		"connection refused", "connection reset",
		"econnreset", "etimedout",
	}
	lower := strings.ToLower(output)
	for _, ind := range indicators {
		if strings.Contains(lower, ind) {
			return true
		}
	}
	return false
}

func buildFlakyCommand(testName, output string) string {
	if strings.Contains(output, "--- FAIL:") {
		return "go test -run " + testName + " -count=3 -v"
	}
	if strings.Contains(output, "FAIL") && strings.Contains(output, ".test.") {
		return "npx jest --testPathPattern=" + testName + " --forceExit"
	}
	if strings.Contains(output, "FAILED") {
		return "python -m pytest " + testName + " -x --timeout=60"
	}
	return "echo 'rerun: " + testName + "'"
}
