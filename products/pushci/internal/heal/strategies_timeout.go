package heal

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var reTimeout = regexp.MustCompile(`timeout[:\s]+(\d+)`)
var reDeadline = regexp.MustCompile(`deadline exceeded.*?(\d+)`)

// timeoutFix detects timeout failures and increases the limit.
func timeoutFix(output string) *Fix {
	if !isTimeoutError(output) {
		return nil
	}
	currentTimeout := extractTimeout(output)
	newTimeout := calculateNewTimeout(currentTimeout)
	cmd := buildTimeoutCommand(output, newTimeout)
	return &Fix{
		Pattern: "timeout-increase",
		Action:  cmd,
	}
}

func isTimeoutError(output string) bool {
	lower := strings.ToLower(output)
	return strings.Contains(lower, "timed out") ||
		strings.Contains(lower, "timeout") ||
		strings.Contains(lower, "deadline exceeded") ||
		strings.Contains(lower, "context deadline") ||
		strings.Contains(lower, "etimedout")
}

func extractTimeout(output string) int {
	if m := reTimeout.FindStringSubmatch(output); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			return v
		}
	}
	if m := reDeadline.FindStringSubmatch(output); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			return v
		}
	}
	return 30 // default 30s
}

func calculateNewTimeout(current int) int {
	doubled := current * 2
	if doubled > 600 {
		return 600 // cap at 10 minutes
	}
	return doubled
}

func buildTimeoutCommand(output string, timeout int) string {
	if strings.Contains(output, "go test") || strings.Contains(output, "--- FAIL:") {
		return fmt.Sprintf("go test ./... -timeout %ds", timeout)
	}
	if strings.Contains(output, "jest") || strings.Contains(output, "vitest") {
		return fmt.Sprintf("npx jest --testTimeout=%d", timeout*1000)
	}
	if strings.Contains(output, "pytest") {
		return fmt.Sprintf("python -m pytest --timeout=%d", timeout)
	}
	return fmt.Sprintf("TIMEOUT=%d", timeout)
}
