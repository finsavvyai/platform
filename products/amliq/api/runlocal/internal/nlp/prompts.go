package nlp

// SystemPrompt is the system instruction for Claude NLP interpretation.
const SystemPrompt = `You are a CI/CD assistant for PushCI.dev.
The user gives natural language commands about their CI/CD pipeline.
You MUST call exactly one tool to fulfill the request.
Never respond with text only — always use a tool.
If the intent is ambiguous, use show_status as a safe default.`

// ToolDefs returns Claude tool definitions for NLP interpretation.
func ToolDefs() []map[string]interface{} {
	return []map[string]interface{}{
		tool("run_pipeline", "Run CI pipeline checks",
			prop("checks", "array", "Specific checks to run, e.g. [\"test\",\"lint\"]. Empty = all.")),
		tool("deploy", "Deploy the project to a target environment",
			prop("target", "string", "Deploy target: staging, production, cloudflare-pages, aws-ecs, etc.")),
		tool("diagnose_failure", "Diagnose why the last CI run failed", nil),
		tool("show_status", "Show the status of the last CI run", nil),
		tool("update_config", "Update pushci.yml configuration",
			prop("key", "string", "Config key path, e.g. deploy.target"),
			prop("value", "string", "New value to set")),
		tool("manage_secret", "Manage encrypted secrets",
			prop("operation", "string", "One of: set, get, list, delete"),
			prop("key", "string", "Secret key name"),
			prop("value", "string", "Secret value (only for set)")),
	}
}

func tool(name, desc string, props ...map[string]interface{}) map[string]interface{} {
	schema := map[string]interface{}{
		"type":       "object",
		"properties": mergeProps(props),
	}
	return map[string]interface{}{
		"name":         name,
		"description":  desc,
		"input_schema": schema,
	}
}

func prop(name, typ, desc string) map[string]interface{} {
	return map[string]interface{}{
		name: map[string]interface{}{"type": typ, "description": desc},
	}
}

func mergeProps(props []map[string]interface{}) map[string]interface{} {
	merged := map[string]interface{}{}
	for _, p := range props {
		if p == nil {
			continue
		}
		for k, v := range p {
			merged[k] = v
		}
	}
	return merged
}
