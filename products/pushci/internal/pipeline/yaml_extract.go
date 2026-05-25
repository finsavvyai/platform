package pipeline

import "strings"

// extractYAMLBlock extracts YAML from a markdown code block.
func extractYAMLBlock(text string) string {
	start := strings.Index(text, "```yaml")
	if start == -1 {
		start = strings.Index(text, "```")
	}
	if start == -1 {
		return text
	}
	nl := strings.Index(text[start:], "\n")
	if nl == -1 {
		return ""
	}
	start += nl + 1
	end := strings.Index(text[start:], "```")
	if end == -1 {
		return text[start:]
	}
	return text[start : start+end]
}
