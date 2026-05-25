package migrate

import "strings"

// stripTerraformComments removes `#` and `//` line comments. Respects
// double-quoted strings so a URL like "https://..." inside a literal
// isn't truncated. Block comments `/* ... */` are rare in Terraform so
// deliberately skipped.
func stripTerraformComments(src string) string {
	var b strings.Builder
	b.Grow(len(src))
	inStr := false
	for i := 0; i < len(src); i++ {
		c := src[i]
		if inStr {
			b.WriteByte(c)
			if c == '\\' && i+1 < len(src) {
				b.WriteByte(src[i+1])
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
			b.WriteByte(c)
			continue
		}
		if c == '#' || (i+1 < len(src) && src[i] == '/' && src[i+1] == '/') {
			nl := strings.IndexByte(src[i:], '\n')
			if nl < 0 {
				break
			}
			i += nl
			b.WriteByte('\n')
			continue
		}
		b.WriteByte(c)
	}
	return b.String()
}

// findMatchingBrace assumes src[open] == '{' and returns index of its
// matching '}'. Respects double-quoted strings and escape sequences.
func findMatchingBrace(src string, open int) int {
	depth, inStr := 0, false
	for i := open; i < len(src); i++ {
		c := src[i]
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
		switch c {
		case '"':
			inStr = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return -1
}
