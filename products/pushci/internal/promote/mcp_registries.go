package promote

import (
	"encoding/json"
	"strings"
)

// MCPPackage is the metadata sent to MCP registries.
type MCPPackage struct {
	Name        string   `json:"name"`
	Command     string   `json:"command"`
	Args        []string `json:"args"`
	Install     string   `json:"install"`
	Repository  string   `json:"repository"`
	Homepage    string   `json:"homepage"`
	Description string   `json:"description"`
	Categories  []string `json:"categories"`
	Keywords    []string `json:"keywords"`
}

// DefaultPackage returns the PushCI MCP package metadata.
func DefaultPackage() MCPPackage {
	return MCPPackage{
		Name:        "pushci",
		Command:     "pushci",
		Args:        []string{"mcp"},
		Install:     "npm install -g pushci",
		Repository:  "https://github.com/finsavvyai/pushci",
		Homepage:    "https://pushci.dev",
		Description: "AI-native zero-config CI/CD. Auto-detects 19 languages, 40+ frameworks. Runs locally for free. Replaces GitHub Actions with zero YAML.",
		Categories:  []string{"ci-cd", "devops", "testing", "deployment", "ai"},
		Keywords:    []string{"CI/CD", "GitHub Actions alternative", "free CI", "zero config", "AI pipeline", "MCP"},
	}
}

// SubmitToMCPRegistries attempts to submit to known MCP registries.
func SubmitToMCPRegistries(pkg MCPPackage) []Registry {
	registries := []struct {
		name   string
		apiURL string
		webURL string
	}{
		{"Smithery", "https://registry.smithery.ai/api/packages", "https://smithery.ai/submit"},
		{"mcp.so", "https://mcp.so/api/submit", "https://mcp.so/submit"},
		{"Glama", "https://glama.ai/api/mcp/packages", "https://glama.ai/mcp/submit"},
	}

	var results []Registry
	data, _ := json.Marshal(pkg)
	for _, r := range registries {
		resp, err := client.Post(r.apiURL, "application/json", strings.NewReader(string(data)))
		if err != nil {
			results = append(results, Registry{
				Name: r.name, URL: r.webURL, Status: "fallback",
				Message: "API unavailable — submit manually at " + r.webURL,
			})
			continue
		}
		resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			results = append(results, Registry{Name: r.name, URL: r.apiURL, Status: "ok"})
		} else {
			results = append(results, Registry{
				Name: r.name, URL: r.webURL, Status: "fallback",
				Message: "Submit manually at " + r.webURL,
			})
		}
	}
	return results
}
