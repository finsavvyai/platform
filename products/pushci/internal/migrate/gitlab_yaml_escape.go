package migrate

import "strings"

// yamlScalarEscape wraps a single-line script in double quotes when
// it contains chars that would otherwise be parsed as YAML
// structure (`:`, `#`, leading `-`, etc). Embedded `"` and `\` are
// escaped — that's all standard YAML allows.
func yamlScalarEscape(s string) string {
	if s == "" {
		return `""`
	}
	if !needsQuoting(s) {
		return s
	}
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`)
	return `"` + r.Replace(s) + `"`
}

func needsQuoting(s string) bool {
	if strings.ContainsAny(s, "#:&*!|>'\"%@`") {
		return true
	}
	return s[0] == '-' || s[0] == '?' || s[0] == ' '
}
