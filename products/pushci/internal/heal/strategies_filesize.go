package heal

import (
	"fmt"
	"regexp"
)

var reFileSizeViolation = regexp.MustCompile(`(\S+):\s+(\d+)\s+lines?\s+\(max\s+(\d+)\)`)

// fileSizeViolation detects files exceeding the configured line limit
// and suggests split points at function/component boundaries.
func fileSizeViolation(output string) *Fix {
	m := reFileSizeViolation.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	filePath := m[1]
	return &Fix{
		Pattern:      "file-size-violation",
		Action:       fmt.Sprintf("echo 'File %s exceeds line limit — split at function boundaries'", filePath),
		FilesChanged: []string{filePath},
	}
}

// fileSizeStrategies returns file-size heal strategies.
func fileSizeStrategies() []strategy {
	return []strategy{
		fileSizeViolation,
	}
}
