package heal

import (
	"regexp"
	"strings"
)

var (
	reMissingBinding = regexp.MustCompile(`(?i)binding\s+["'](\w+)["']\s+not found`)
	reMissingKV      = regexp.MustCompile(`(?i)kv namespace\s+["'](\w+)["']\s+not found`)
	reMissingD1      = regexp.MustCompile(`(?i)d1 database\s+["'](\w+)["']\s+not found`)
)

// wranglerMissingBinding detects missing bindings in wrangler deploy.
func wranglerMissingBinding(output string) *Fix {
	m := reMissingBinding.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	binding := m[1]
	return &Fix{
		Pattern: "wrangler-missing-binding",
		Action:  "echo 'Add binding " + binding + " to wrangler.toml'",
	}
}

// wranglerMissingKV detects missing KV namespace bindings.
func wranglerMissingKV(output string) *Fix {
	m := reMissingKV.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	ns := m[1]
	return &Fix{
		Pattern: "wrangler-missing-kv",
		Action:  "npx wrangler kv namespace create " + ns,
	}
}

// wranglerMissingD1 detects missing D1 database bindings.
func wranglerMissingD1(output string) *Fix {
	m := reMissingD1.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	db := m[1]
	return &Fix{
		Pattern: "wrangler-missing-d1",
		Action:  "echo 'Create D1 database: npx wrangler d1 create " + db + "'",
	}
}

// wranglerAuthError detects wrangler authentication failures.
func wranglerAuthError(output string) *Fix {
	if !strings.Contains(output, "Authentication error") &&
		!strings.Contains(output, "not authenticated") &&
		!strings.Contains(output, "CLOUDFLARE_API_TOKEN") {
		return nil
	}
	return &Fix{
		Pattern: "wrangler-auth",
		Action:  "npx wrangler login",
	}
}

// wranglerStrategies returns all Wrangler heal strategies.
func wranglerStrategies() []strategy {
	return []strategy{
		wranglerMissingBinding,
		wranglerMissingKV,
		wranglerMissingD1,
		wranglerAuthError,
	}
}
