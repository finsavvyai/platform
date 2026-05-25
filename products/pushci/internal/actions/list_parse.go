package actions

import "strings"

// splitColumns is space-tolerant: act emits multiple spaces between
// columns, not tabs. We collapse runs of whitespace and split.
func splitColumns(line string) []string {
	var out []string
	cur := strings.Builder{}
	inSpace := false
	for _, r := range line {
		if r == ' ' || r == '\t' {
			if !inSpace && cur.Len() > 0 {
				out = append(out, cur.String())
				cur.Reset()
			}
			inSpace = true
			continue
		}
		inSpace = false
		cur.WriteRune(r)
	}
	if cur.Len() > 0 {
		out = append(out, cur.String())
	}
	return out
}
