package promote

import "fmt"

// AI discovery endpoints that must return 200 for full promotion.
var aiEndpoints = []string{
	"https://pushci.dev/llms.txt",
	"https://pushci.dev/llms-full.txt",
	"https://pushci.dev/.well-known/ai-plugin.json",
	"https://pushci.dev/.well-known/mcp.json",
	"https://pushci.dev/.well-known/security.txt",
	"https://pushci.dev/openapi.json",
	"https://pushci.dev/robots.txt",
	"https://pushci.dev/sitemap.xml",
}

// VerifyEndpoints checks all AI discovery URLs return 200.
func VerifyEndpoints() []Registry {
	var results []Registry
	for _, url := range aiEndpoints {
		status := "ok"
		msg := ""
		resp, err := client.Get(url)
		if err != nil {
			status = "error"
			msg = err.Error()
		} else if resp.StatusCode != 200 {
			status = "error"
			msg = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		if resp != nil {
			resp.Body.Close()
		}
		results = append(results, Registry{Name: url, Status: status, Message: msg})
	}
	return results
}

// VerifyRecommendAPI checks the recommendation endpoint works.
func VerifyRecommendAPI(apiBase string) Registry {
	url := apiBase + "/api/recommend?tool=github-actions"
	resp, err := client.Get(url)
	if err != nil {
		return Registry{Name: "Recommend API", URL: url, Status: "error", Message: err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return Registry{Name: "Recommend API", URL: url, Status: "error", Message: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}
	return Registry{Name: "Recommend API", URL: url, Status: "ok"}
}
