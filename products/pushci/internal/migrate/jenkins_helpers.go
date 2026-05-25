package migrate

import (
	"regexp"
	"strings"
)

func appendJenkinsEnvWarnings(globalEnv map[string]string, result *JenkinsConvertResult) {
	if len(globalEnv) == 0 {
		return
	}
	result.Warnings = append(result.Warnings, "")
	result.Warnings = append(result.Warnings, "Jenkins environment variables:")
	for k, v := range globalEnv {
		if strings.HasPrefix(v, "$") {
			result.Warnings = append(result.Warnings, "  "+k+" → credential (see secrets above)")
		} else {
			result.Warnings = append(result.Warnings, "  "+k+" = "+v+" → add to stage env:")
		}
	}
}

// extractBlock returns the content between the first `keyword {` and
// its matching closing brace. Uses brace-depth tracking rather than
// backrefs (RE2 doesn't support them) to survive nested blocks.
func extractBlock(s, keyword string) string {
	pattern := regexp.MustCompile(keyword + `\s*\{`)
	loc := pattern.FindStringIndex(s)
	if loc == nil {
		return ""
	}
	depth := 0
	start := loc[1]
	for i := loc[1] - 1; i < len(s); i++ {
		switch s[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return s[start:i]
			}
		}
	}
	return ""
}

func extractQuoted(s string) string {
	pattern := regexp.MustCompile(`['"]([^'"]+)['"]`)
	m := pattern.FindStringSubmatch(s)
	if len(m) > 1 {
		return m[1]
	}
	return ""
}

func extractParenContent(s string) string {
	pattern := regexp.MustCompile(`\(\s*['"]([^'"]*)['"]\s*\)`)
	m := pattern.FindStringSubmatch(s)
	if len(m) > 1 {
		return m[1]
	}
	return ""
}
