package analysis

import (
	"regexp"
	"strings"
)

// extractSecret pulls the raw secret from a line given the pattern name.
func extractSecret(patternName, line string) string {
	nameLower := strings.ToLower(patternName)
	var re *regexp.Regexp
	switch {
	case strings.Contains(nameLower, "aws access"):
		re = regexp.MustCompile(`AKIA[0-9A-Z]{16}`)
	case strings.Contains(nameLower, "github"):
		re = regexp.MustCompile(`gh[pos]_[A-Za-z0-9_]{36,255}`)
	case strings.Contains(nameLower, "gitlab"):
		re = regexp.MustCompile(`glpat-[A-Za-z0-9_\-]{20,}`)
	case strings.Contains(nameLower, "slack"):
		re = regexp.MustCompile(`xox[bp]-[0-9A-Za-z\-]+`)
	case strings.Contains(nameLower, "jwt"):
		re = regexp.MustCompile(`eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+`)
	default:
		return ""
	}
	return re.FindString(line)
}
