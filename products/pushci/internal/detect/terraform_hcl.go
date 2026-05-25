package detect

import (
	"regexp"
	"strings"
)

var (
	blockCommentRe = regexp.MustCompile(`(?s)/\*.*?\*/`)
	heredocRe      = regexp.MustCompile(`<<-?([A-Za-z_][A-Za-z0-9_]*)\s*$`)
)

// preprocessHcl strips comments and heredoc bodies. Same behaviour as
// the TypeScript sibling in api/src/terraform.ts.
func preprocessHcl(src string) string {
	src = blockCommentRe.ReplaceAllString(src, "")
	lines := strings.Split(src, "\n")
	out := make([]string, 0, len(lines))
	var heredocTag string
	for _, raw := range lines {
		if heredocTag != "" {
			if strings.TrimSpace(raw) == heredocTag {
				heredocTag = ""
			}
			out = append(out, "")
			continue
		}
		kept, newTag := processLine(raw)
		out = append(out, kept)
		heredocTag = newTag
	}
	return strings.Join(out, "\n")
}

func processLine(raw string) (kept, newHeredocTag string) {
	trimmed := strings.TrimLeft(raw, " \t")
	if strings.HasPrefix(trimmed, "#") || strings.HasPrefix(trimmed, "//") {
		return "", ""
	}
	if m := heredocRe.FindStringSubmatchIndex(raw); m != nil {
		return raw[:m[0]], raw[m[2]:m[3]]
	}
	return raw, ""
}
