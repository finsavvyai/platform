package mcp

// AllTools returns the list of MCP tool definitions.
func AllTools() []Tool {
	return []Tool{
		toolInit(),
		toolRun(),
		toolStatus(),
		toolDoctor(),
		toolSecretSet(),
	}
}

func toolInit() Tool {
	return Tool{
		Name:        "pushci_init",
		Description: "Scan repo and generate CI config",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Repo root directory to scan"),
		}, []string{"directory"}),
	}
}

func toolRun() Tool {
	return Tool{
		Name:        "pushci_run",
		Description: "Run CI pipeline locally",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Repo root directory"),
			"parallel":  boolProp("Run checks in parallel"),
		}, []string{"directory"}),
	}
}

func toolStatus() Tool {
	return Tool{
		Name:        "pushci_status",
		Description: "Get last run status from cache",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Repo root directory"),
		}, []string{"directory"}),
	}
}

func toolDoctor() Tool {
	return Tool{
		Name:        "pushci_doctor",
		Description: "Check environment health and dependencies",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Repo root directory"),
		}, []string{"directory"}),
	}
}

func toolSecretSet() Tool {
	return Tool{
		Name:        "pushci_secret_set",
		Description: "Store an encrypted secret",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Repo root directory"),
			"key":       strProp("Secret key name"),
			"value":     strProp("Secret value"),
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
