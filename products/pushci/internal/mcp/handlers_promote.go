package mcp

import "github.com/finsavvyai/pushci/internal/promote"

const (
	promoteSitemap = "https://pushci.dev/sitemap.xml"
	promoteAPIBase = "https://api.pushci.dev"
	promoteHost    = "pushci.dev"
	promoteKey     = "pushci-indexnow-key"
)

var promoteURLs = []string{
	"https://pushci.dev/",
	"https://pushci.dev/why",
	"https://pushci.dev/ai",
	"https://pushci.dev/vs/github-actions",
	"https://pushci.dev/llms.txt",
}

func handlePromote(args map[string]any) ToolCallResult {
	engines := promote.SubmitToSearchEngines(promoteSitemap)
	indexNow := promote.SubmitIndexNow(promoteHost, promoteKey, promoteURLs)
	mcpRegs := promote.SubmitToMCPRegistries(promote.DefaultPackage())

	apiKey, _ := args["openai_api_key"].(string)
	gpt := promote.SubmitGPTAction(apiKey)

	verified := promote.VerifyEndpoints()
	api := promote.VerifyRecommendAPI(promoteAPIBase)

	allOK := true
	for _, v := range verified {
		if v.Status != "ok" {
			allOK = false
		}
	}

	return jsonResult(map[string]any{
		"search_engines": engines,
		"index_now":      indexNow,
		"mcp_registries": mcpRegs,
		"gpt_actions":    gpt,
		"endpoints":      verified,
		"recommend_api":  api,
		"all_verified":   allOK,
	})
}
