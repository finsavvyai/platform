package handlers

// openAPISpec is the OpenAPI 3.0.0 specification for the PipeWarden API.
var openAPISpec = map[string]interface{}{
	"openapi": "3.0.0",
	"info": map[string]interface{}{
		"title":       "PipeWarden API",
		"version":     "1.0.0",
		"description": "DevSecOps Pipeline Orchestrator — security guardian for CI/CD pipelines across GitHub Actions, GitLab CI/CD, Bitbucket Pipelines, Jenkins, Azure DevOps, and CircleCI.",
	},
	"servers": []map[string]string{
		{"url": "https://app.pipewarden.com"},
	},
	"tags": []map[string]string{
		{"name": "connections", "description": "Manage CI/CD provider connections"},
		{"name": "analysis", "description": "Security analysis and scanning"},
		{"name": "findings", "description": "Security findings management"},
		{"name": "compliance", "description": "Compliance reporting (SOC2/HIPAA/GDPR/PCI-DSS)"},
		{"name": "analytics", "description": "Trends and summary analytics"},
		{"name": "webhooks", "description": "Webhook configuration and management"},
		{"name": "team", "description": "Team member management (Enterprise)"},
	},
	"components": map[string]interface{}{
		"securitySchemes": map[string]interface{}{
			"BearerAuth": map[string]interface{}{
				"type":         "http",
				"scheme":       "bearer",
				"bearerFormat": "JWT",
			},
		},
		"schemas": buildSchemas(),
	},
	"security": []map[string][]string{
		{"BearerAuth": {}},
	},
	"paths": buildPaths(),
}

func buildSchemas() map[string]interface{} {
	return map[string]interface{}{
		"Connection": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name":          map[string]string{"type": "string"},
				"platform":      map[string]string{"type": "string", "enum": "github,gitlab,bitbucket,jenkins,azure,circleci"},
				"health_status": map[string]string{"type": "string"},
				"created_at":    map[string]string{"type": "string", "format": "date-time"},
			},
		},
		"Finding": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":          map[string]string{"type": "integer"},
				"severity":    map[string]string{"type": "string", "enum": "critical,high,medium,low,info"},
				"category":    map[string]string{"type": "string"},
				"title":       map[string]string{"type": "string"},
				"description": map[string]string{"type": "string"},
				"remediation": map[string]string{"type": "string"},
				"status":      map[string]string{"type": "string"},
			},
		},
		"TeamMember": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":         map[string]string{"type": "integer"},
				"email":      map[string]string{"type": "string", "format": "email"},
				"role":       map[string]string{"type": "string", "enum": "admin,member,viewer"},
				"status":     map[string]string{"type": "string", "enum": "invited,active,suspended"},
				"invited_at": map[string]string{"type": "string", "format": "date-time"},
			},
		},
		"Error": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"error": map[string]string{"type": "string"},
			},
		},
	}
}

func buildPaths() map[string]interface{} {
	ref := func(s string) map[string]interface{} {
		return map[string]interface{}{"$ref": "#/components/schemas/" + s}
	}
	arrayOf := func(s string) map[string]interface{} {
		return map[string]interface{}{"type": "array", "items": ref(s)}
	}
	jsonResp := func(schema map[string]interface{}, desc string) map[string]interface{} {
		return map[string]interface{}{
			"description": desc,
			"content":     map[string]interface{}{"application/json": map[string]interface{}{"schema": schema}},
		}
	}
	errResp := func(desc string) map[string]interface{} { return jsonResp(ref("Error"), desc) }

	return map[string]interface{}{
		"/api/v1/connections": map[string]interface{}{
			"get": map[string]interface{}{
				"tags": []string{"connections"}, "summary": "List all connections",
				"responses": map[string]interface{}{"200": jsonResp(arrayOf("Connection"), "Connection list"), "401": errResp("Unauthorized")},
			},
			"post": map[string]interface{}{
				"tags": []string{"connections"}, "summary": "Create connection",
				"responses": map[string]interface{}{"201": jsonResp(ref("Connection"), "Created"), "400": errResp("Bad request"), "409": errResp("Conflict")},
			},
		},
		"/api/v1/connections/{name}": map[string]interface{}{
			"get":    map[string]interface{}{"tags": []string{"connections"}, "summary": "Get connection", "responses": map[string]interface{}{"200": jsonResp(ref("Connection"), "Connection"), "404": errResp("Not found")}},
			"delete": map[string]interface{}{"tags": []string{"connections"}, "summary": "Delete connection", "responses": map[string]interface{}{"200": jsonResp(ref("Connection"), "Deleted"), "404": errResp("Not found")}},
		},
		"/api/v1/analysis/run": map[string]interface{}{
			"post": map[string]interface{}{
				"tags": []string{"analysis"}, "summary": "Run full security analysis",
				"responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Analysis result"), "400": errResp("Bad request")},
			},
		},
		"/api/v1/analysis/quick": map[string]interface{}{
			"post": map[string]interface{}{
				"tags": []string{"analysis"}, "summary": "Run quick heuristic scan",
				"responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Quick scan result")},
			},
		},
		"/api/v1/analysis/findings": map[string]interface{}{
			"get": map[string]interface{}{"tags": []string{"findings"}, "summary": "List findings", "responses": map[string]interface{}{"200": jsonResp(arrayOf("Finding"), "Findings list")}},
		},
		"/api/v1/analysis/findings/export": map[string]interface{}{
			"get": map[string]interface{}{"tags": []string{"findings"}, "summary": "Export findings (JSON/CSV/SARIF)", "responses": map[string]interface{}{"200": map[string]interface{}{"description": "Export file"}}},
		},
		"/api/v1/analysis/history": map[string]interface{}{
			"get": map[string]interface{}{"tags": []string{"analysis"}, "summary": "Analysis history", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "History")}},
		},
		"/api/v1/analysis/stats": map[string]interface{}{
			"get": map[string]interface{}{"tags": []string{"analysis"}, "summary": "Analysis statistics", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Stats")}},
		},
		"/api/v1/dlp/scan": map[string]interface{}{
			"post": map[string]interface{}{"tags": []string{"analysis"}, "summary": "DLP secret scan", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "DLP result")}},
		},
		"/api/v1/policy/evaluate": map[string]interface{}{
			"post": map[string]interface{}{"tags": []string{"compliance"}, "summary": "Evaluate OPA policies", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Policy result")}},
		},
		"/api/v1/compliance/{framework}": map[string]interface{}{
			"get": map[string]interface{}{"tags": []string{"compliance"}, "summary": "Generate compliance report (SOC2/HIPAA/GDPR/PCI-DSS)", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Compliance report")}},
		},
		"/api/v1/analytics/trends": map[string]interface{}{
			"get": map[string]interface{}{"tags": []string{"analytics"}, "summary": "Finding trends over time", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Trends")}},
		},
		"/api/v1/analytics/summary": map[string]interface{}{
			"get": map[string]interface{}{"tags": []string{"analytics"}, "summary": "Analytics summary", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Summary")}},
		},
		"/api/v1/analytics/top-findings": map[string]interface{}{
			"get": map[string]interface{}{"tags": []string{"analytics"}, "summary": "Top findings by frequency", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Top findings")}},
		},
		"/api/v1/webhooks/configure": map[string]interface{}{
			"post": map[string]interface{}{"tags": []string{"webhooks"}, "summary": "Configure webhook endpoint", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Webhook config")}},
		},
		"/api/v1/webhooks/test": map[string]interface{}{
			"post": map[string]interface{}{"tags": []string{"webhooks"}, "summary": "Test webhook delivery", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Test result")}},
		},
		"/api/v1/team/members": map[string]interface{}{
			"get": map[string]interface{}{
				"tags": []string{"team"}, "summary": "List team members",
				"responses": map[string]interface{}{"200": jsonResp(arrayOf("TeamMember"), "Members list")},
			},
			"post": map[string]interface{}{
				"tags": []string{"team"}, "summary": "Invite team member",
				"responses": map[string]interface{}{"201": jsonResp(ref("TeamMember"), "Invited"), "400": errResp("Invalid input"), "409": errResp("Already exists")},
			},
		},
		"/api/v1/team/members/{email}": map[string]interface{}{
			"delete": map[string]interface{}{"tags": []string{"team"}, "summary": "Remove team member", "responses": map[string]interface{}{"200": jsonResp(map[string]interface{}{"type": "object"}, "Removed"), "404": errResp("Not found")}},
		},
		"/api/v1/team/members/{email}/role": map[string]interface{}{
			"put": map[string]interface{}{"tags": []string{"team"}, "summary": "Update member role", "responses": map[string]interface{}{"200": jsonResp(ref("TeamMember"), "Updated"), "400": errResp("Invalid role"), "404": errResp("Not found")}},
		},
		"/api/v1/docs": map[string]interface{}{
			"get": map[string]interface{}{
				"tags": []string{"connections"}, "summary": "OpenAPI 3.0 specification", "security": []map[string][]string{},
				"responses": map[string]interface{}{"200": map[string]interface{}{"description": "OpenAPI spec JSON"}},
			},
		},
	}
}
