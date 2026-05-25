package mcp

// toolPromote registers PushCI with AI registries and search engines.
func toolPromote() Tool {
	return Tool{
		Name:        "pushci_promote",
		Description: "Register PushCI with AI tool registries (Smithery, mcp.so, Glama), search engines (Google, Bing, IndexNow), and GPT Actions. Verifies all AI discovery endpoints are live. Run after every deploy to maximize AI agent discoverability.",
		InputSchema: objSchema(map[string]any{
			"openai_api_key": strProp("Optional OpenAI API key for GPT Actions auto-registration"),
		}, nil),
	}
}
