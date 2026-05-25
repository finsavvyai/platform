package migrate

import (
	"regexp"
	"strings"
)

// tfBlock is a generic Terraform HCL block: `<Kind> "lbl1" "lbl2" { <Body> }`.
// For resources: Kind="resource", Labels=[type, name].
type tfBlock struct {
	Kind   string
	Labels []string
	Body   string
	Raw    string
}

var (
	tfHeaderRE = regexp.MustCompile(`^([a-zA-Z_][a-zA-Z0-9_]*)\s*((?:"[^"]*"\s*)*)\{`)
	tfAttrRE   = regexp.MustCompile(`(?m)^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+?)\s*$`)
	tfLabelRE  = regexp.MustCompile(`"([^"]*)"`)
)

// parseTerraformBlocks is a focused brace-matching parser: it extracts
// top-level blocks from HCL text. Comments are stripped first; strings
// are respected so braces inside "{" don't confuse the matcher.
func parseTerraformBlocks(src string) []tfBlock {
	src = stripTerraformComments(src)
	var out []tfBlock
	for i := 0; i < len(src); {
		for i < len(src) && (src[i] == ' ' || src[i] == '\t' || src[i] == '\n' || src[i] == '\r') {
			i++
		}
		if i >= len(src) {
			break
		}
		rest := src[i:]
		m := tfHeaderRE.FindStringSubmatchIndex(rest)
		if m == nil {
			nl := strings.IndexByte(rest, '\n')
			if nl < 0 {
				break
			}
			i += nl + 1
			continue
		}
		kind := rest[m[2]:m[3]]
		labelStr := rest[m[4]:m[5]]
		bodyStart := i + m[1]
		end := findMatchingBrace(src, bodyStart-1)
		if end < 0 {
			break
		}
		out = append(out, tfBlock{
			Kind:   kind,
			Labels: extractTerraformLabels(labelStr),
			Body:   src[bodyStart:end],
			Raw:    src[i : end+1],
		})
		i = end + 1
	}
	return out
}

// parseTerraformAttrs returns a flat map of attr=value on the given body.
// Nested blocks are elided first so `name = "Source"` at the outer scope
// isn't overwritten by a nested `action { name = "S3_Source" }`.
// Value retains quoting so callers can distinguish strings vs. refs.
func parseTerraformAttrs(body string) map[string]string {
	body = elideNestedBlocks(body)
	out := map[string]string{}
	for _, m := range tfAttrRE.FindAllStringSubmatch(body, -1) {
		out[m[1]] = strings.TrimSpace(m[2])
	}
	return out
}

// unquoteTF strips wrapping quotes from a Terraform literal, returning
// the raw token if unquoted (refs like `var.x` pass through).
func unquoteTF(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		return s[1 : len(s)-1]
	}
	return s
}

func extractTerraformLabels(s string) []string {
	var labels []string
	for _, m := range tfLabelRE.FindAllStringSubmatch(s, -1) {
		labels = append(labels, m[1])
	}
	return labels
}
