package main

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// topKey reads a top-level YAML scalar `name:` line. Returns the value
// (unquoted) and whether the key matched.
func topKey(line, key string) (string, bool) {
	prefix := key + ":"
	if !strings.HasPrefix(line, prefix) {
		return "", false
	}
	return unquote(strings.TrimSpace(line[len(prefix):])), true
}

// inputHeader recognizes a line like `  my-input:` inside the inputs
// block. Four-space indentation is a field of the current input; two
// spaces indicates a new input header.
func inputHeader(line string) (string, bool) {
	if !strings.HasPrefix(line, "  ") || strings.HasPrefix(line, "    ") {
		return "", false
	}
	trimmed := strings.TrimSpace(line)
	if !strings.HasSuffix(trimmed, ":") {
		return "", false
	}
	return strings.TrimSuffix(trimmed, ":"), true
}

// indentedField reads `    key: value` lines under an input header.
func indentedField(line string) (string, string, bool) {
	if !strings.HasPrefix(line, "    ") {
		return "", "", false
	}
	trimmed := strings.TrimSpace(line)
	idx := strings.IndexByte(trimmed, ':')
	if idx < 0 {
		return "", "", false
	}
	return trimmed[:idx], unquote(strings.TrimSpace(trimmed[idx+1:])), true
}

func unquote(s string) string {
	if len(s) >= 2 && (s[0] == '"' || s[0] == '\'') && s[len(s)-1] == s[0] {
		return s[1 : len(s)-1]
	}
	return s
}

// renderMarketplaceStage turns a parsed ref + filled-in values into a
// pushci.yml stage fragment users can paste into their config.
func renderMarketplaceStage(r marketplaceRef, actionName string, values map[string]string) string {
	uses := fmt.Sprintf("%s/%s", r.owner, r.repo)
	if r.subpath != "" {
		uses += "/" + r.subpath
	}
	uses += "@" + r.version
	var sb strings.Builder
	sb.WriteString("- name: " + safeName(actionName, r.repo) + "\n")
	sb.WriteString("  uses: " + uses + "\n")
	if len(values) > 0 {
		sb.WriteString("  with:\n")
		keys := make([]string, 0, len(values))
		for k := range values {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Fprintf(&sb, "    %s: %s\n", k, quoteYamlScalar(values[k]))
		}
	}
	return sb.String()
}

var safeNameRE = regexp.MustCompile(`[^a-z0-9]+`)
var simpleScalarRE = regexp.MustCompile(`^[A-Za-z0-9_.\-/]+$`)

func safeName(name, fallback string) string {
	if name == "" {
		name = fallback
	}
	return strings.Trim(safeNameRE.ReplaceAllString(strings.ToLower(name), "-"), "-")
}

func quoteYamlScalar(v string) string {
	if simpleScalarRE.MatchString(v) {
		return "'" + v + "'"
	}
	return "\"" + strings.ReplaceAll(v, "\"", "\\\"") + "\""
}
