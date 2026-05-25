package mcp

// allToolDefs returns MCP tool definitions for all AMLIQ tools.
func allToolDefs() []ToolDef {
	return []ToolDef{
		screenEntityDef(), checkPEPDef(),
		analyzeTxnDef(), getEntityDef(), countryRiskDef(),
		explainMatchDef(), monitorEntityDef(),
	}
}

func screenEntityDef() ToolDef {
	return ToolDef{
		Name:        "screen_entity",
		Description: "Screen a name against global sanctions and PEP lists",
		InputSchema: objSchema(map[string]interface{}{
			"name":      strProp("Entity name to screen"),
			"lists":     arrayProp("List IDs to filter (e.g. ofac, eu_fsf, un)"),
			"threshold": numProp("Minimum confidence threshold 0-1"),
		}, []string{"name"}),
	}
}

func checkPEPDef() ToolDef {
	return ToolDef{
		Name:        "check_pep",
		Description: "Check if a person is a Politically Exposed Person",
		InputSchema: objSchema(map[string]interface{}{
			"name":    strProp("Person name to check"),
			"country": strProp("ISO country code filter"),
		}, []string{"name"}),
	}
}

func analyzeTxnDef() ToolDef {
	return ToolDef{
		Name:        "analyze_transaction",
		Description: "Screen a transaction for sanctions and risk patterns",
		InputSchema: objSchema(map[string]interface{}{
			"sender":           strProp("Sender name"),
			"receiver":         strProp("Receiver name"),
			"amount":           numProp("Transaction amount"),
			"sender_country":   strProp("Sender ISO country code"),
			"receiver_country": strProp("Receiver ISO country code"),
		}, []string{"sender", "receiver", "amount"}),
	}
}

func getEntityDef() ToolDef {
	return ToolDef{
		Name:        "get_entity_details",
		Description: "Look up a specific sanctioned entity by ID",
		InputSchema: objSchema(map[string]interface{}{
			"entity_id": strProp("Entity ID (e.g. ent_xxxxxxxxxxxx)"),
		}, []string{"entity_id"}),
	}
}

func countryRiskDef() ToolDef {
	return ToolDef{
		Name:        "check_country_risk",
		Description: "FATF risk assessment for a country",
		InputSchema: objSchema(map[string]interface{}{
			"country_code": strProp("ISO 2-letter country code"),
		}, []string{"country_code"}),
	}
}

func objSchema(props map[string]interface{}, req []string) map[string]interface{} {
	s := map[string]interface{}{"type": "object"}
	if props != nil {
		s["properties"] = props
	}
	if req != nil {
		s["required"] = req
	}
	return s
}

func strProp(desc string) map[string]string {
	return map[string]string{"type": "string", "description": desc}
}

func numProp(desc string) map[string]string {
	return map[string]string{"type": "number", "description": desc}
}

func arrayProp(desc string) map[string]interface{} {
	return map[string]interface{}{
		"type": "array", "description": desc,
		"items": map[string]string{"type": "string"},
	}
}
