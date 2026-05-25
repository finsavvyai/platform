package migrate

import (
	"strings"

	"gopkg.in/yaml.v3"
)

// toStringBK coerces an arbitrary YAML node to a trimmed string.
func toStringBK(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	b, _ := yaml.Marshal(v)
	return strings.TrimSpace(string(b))
}

func toStringList(v interface{}) []string {
	switch t := v.(type) {
	case string:
		if t != "" {
			return []string{t}
		}
	case []interface{}:
		var out []string
		for _, x := range t {
			if s := toStringBK(x); s != "" {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

func intOrZero(v interface{}) int {
	switch t := v.(type) {
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	}
	return 0
}

func pluginNames(v interface{}) []string {
	var names []string
	switch t := v.(type) {
	case []interface{}:
		for _, p := range t {
			if s, ok := p.(string); ok {
				names = append(names, s)
				continue
			}
			if m, ok := p.(map[string]interface{}); ok {
				for k := range m {
					names = append(names, k)
				}
			}
		}
	case map[string]interface{}:
		for k := range t {
			names = append(names, k)
		}
	}
	return names
}

// yamlScalar quotes a command for safe inline emission. Pipes, colons,
// and newlines would otherwise break the YAML scalar on the `run:` line.
func yamlScalar(s string) string {
	if strings.ContainsAny(s, ":#\n|>'\"") {
		return "\"" + strings.ReplaceAll(s, "\"", "\\\"") + "\""
	}
	return s
}
