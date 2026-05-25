package mcp

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/screening"
)

// explainMatchDef is the MCP tool definition for the audit-defense
// `explain_match` tool. It returns the full per-layer cascade evidence
// (algorithm, score, matched substring, per-layer rationale) plus a
// natural-language explanation analysts can paste into a memo.
func explainMatchDef() ToolDef {
	return ToolDef{
		Name: "explain_match",
		Description: "Return the full layer-by-layer cascade " +
			"(exact, fuzzy, phonetic, token, embedding, graph) for a " +
			"screening match, with matched substrings and rationale. " +
			"Use to defend a match in audit.",
		InputSchema: objSchema(map[string]interface{}{
			"name":             strProp("Entity name that produced the match"),
			"target_entity_id": strProp("Optional: entity ID to filter to a specific match"),
			"list_id":          strProp("Optional: list ID filter (e.g. ofac, eu_fsf)"),
		}, []string{"name"}),
	}
}

type explainParams struct {
	Name           string `json:"name"`
	TargetEntityID string `json:"target_entity_id"`
	ListID         string `json:"list_id"`
}

func (s *Server) handleExplainMatch(params json.RawMessage) (interface{}, error) {
	var p explainParams
	if err := json.Unmarshal(params, &p); err != nil {
		return nil, fmt.Errorf("bad params: %w", err)
	}
	if strings.TrimSpace(p.Name) == "" {
		return nil, fmt.Errorf("name is required")
	}
	opts := screening.SearchOpts{Limit: 20}
	if p.ListID != "" {
		opts.Lists = []string{p.ListID}
	}
	results, err := s.engine.ScreenByName(p.Name, opts)
	if err != nil {
		return nil, err
	}
	target := pickExplainTarget(results, p.TargetEntityID)
	if target == nil {
		return map[string]interface{}{
			"matched":   false,
			"rationale": "No screening match for the supplied name.",
		}, nil
	}
	return buildExplainResponse(*target), nil
}
