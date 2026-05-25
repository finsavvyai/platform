package migrate

import "strings"

// elideNestedBlocks replaces any `<name> { ... }` or `<name> = { ... }`
// child block with an empty string so flat attr parsing stays scoped to
// the current level.
func elideNestedBlocks(body string) string {
	var b strings.Builder
	i := 0
	for i < len(body) {
		open := findNextBlockOpen(body, i)
		if open < 0 {
			b.WriteString(body[i:])
			return b.String()
		}
		b.WriteString(body[i:open])
		end := findMatchingBrace(body, open)
		if end < 0 {
			return b.String()
		}
		i = end + 1
	}
	return b.String()
}

// findNextBlockOpen returns the index of the `{` that starts the next
// child block after start, or -1. Respects strings.
func findNextBlockOpen(body string, start int) int {
	inStr := false
	for i := start; i < len(body); i++ {
		c := body[i]
		if inStr {
			if c == '\\' {
				i++
				continue
			}
			if c == '"' {
				inStr = false
			}
			continue
		}
		if c == '"' {
			inStr = true
			continue
		}
		if c == '{' {
			return i
		}
	}
	return -1
}
