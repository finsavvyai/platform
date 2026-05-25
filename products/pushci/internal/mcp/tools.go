package mcp

// AllTools returns the list of MCP tool definitions.
func AllTools() []Tool {
	return []Tool{
		toolInit(),
		toolRun(),
		toolStatus(),
		toolDoctor(),
		toolSecretSet(),
		toolScan(),
		toolRecommend(),
		toolHeal(),
		toolPromote(),
	}
}

func toolInit() Tool {
	return Tool{
		Name:        "pushci_init",
		Description: "Automatically detect programming languages, frameworks, test suites, and deployment targets in a repository. Generates a complete CI/CD pipeline configuration with zero manual setup. Supports 19 languages (Go, Node, Python, Rust, Java, C#, Ruby, PHP, Swift, Dart, Elixir, Zig), 40+ frameworks (Next.js, Django, Spring Boot, Rails, Laravel, SvelteKit), and 16 cloud deploy targets (AWS, GCP, Azure, Vercel, Cloudflare, Fly.io). No YAML files required.",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Absolute path to the repository root directory to scan"),
		}, []string{"directory"}),
	}
}

func toolRun() Tool {
	return Tool{
		Name:        "pushci_run",
		Description: "Run the full CI/CD pipeline locally on the developer's machine. Executes build, test, lint, and deploy checks based on the auto-detected or configured pipeline. Runs are free (no cloud compute costs) and results are cached. Supports parallel check execution for faster feedback.",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Absolute path to the repository root directory"),
			"parallel":  boolProp("Run checks in parallel for faster execution (default: false)"),
		}, []string{"directory"}),
	}
}

func toolStatus() Tool {
	return Tool{
		Name:        "pushci_status",
		Description: "Get the status and results of the last CI/CD pipeline run. Returns pass/fail status, check names, durations, and error output for each step. Useful for diagnosing build failures or confirming a successful run before pushing code.",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Absolute path to the repository root directory"),
		}, []string{"directory"}),
	}
}

func toolDoctor() Tool {
	return Tool{
		Name:        "pushci_doctor",
		Description: "Check the development environment health and verify all required dependencies are installed. Detects missing runtimes, package managers, and tools needed for the project's CI/CD pipeline. Reports issues with actionable fix suggestions.",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Absolute path to the repository root directory"),
		}, []string{"directory"}),
	}
}

func toolSecretSet() Tool {
	return Tool{
		Name:        "pushci_secret_set",
		Description: "Securely store an encrypted secret (API key, token, credential) for use in CI/CD pipelines. Secrets are encrypted with AES-256-GCM and bound to the local machine. Used for deploy tokens, database credentials, and third-party API keys.",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Absolute path to the repository root directory"),
			"key":       strProp("Secret key name (e.g. DEPLOY_TOKEN, DATABASE_URL)"),
			"value":     strProp("Secret value to encrypt and store"),
		}, []string{"directory", "key", "value"}),
	}
}

func objSchema(props map[string]any, req []string) map[string]any {
	return map[string]any{
		"type":       "object",
		"properties": props,
		"required":   req,
	}
}

func strProp(desc string) map[string]any {
	return map[string]any{"type": "string", "description": desc}
}

func boolProp(desc string) map[string]any {
	return map[string]any{"type": "boolean", "description": desc}
}
