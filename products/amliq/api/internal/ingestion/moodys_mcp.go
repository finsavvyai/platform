package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
)

// MoodysMCP is the AMLIQ side of the partnership: we call Moody's
// MCP-shaped screening tool to enrich our existing PEP/sanctions
// pipeline. Their endpoint exposes a tools/call shape; this adapter
// is opinionated on the *contract we treat as canonical*. If Moody's
// public schema diverges in production, the parse step in
// ScreenMoodys is the seam to update — the rest of the pipeline
// keeps using MoodysMatch as written.
type MoodysMCP struct {
	client *MCPClient
}

// MoodysMatch is the internal AMLIQ-shaped row we persist into the
// pep + adverse-media tables. Direct mapping from upstream's text
// payload — anything we don't recognize gets dropped (forward-compat).
type MoodysMatch struct {
	EntityID    string  `json:"entity_id"`
	Name        string  `json:"name"`
	MatchType   string  `json:"match_type"` // pep, sanction, adverse_media
	Tier        int     `json:"tier"`       // PEP tier 1-4 when applicable
	Country     string  `json:"country"`
	Confidence  float64 `json:"confidence"`
	SourceURL   string  `json:"source_url"`
	LastUpdated string  `json:"last_updated"`
}

// NewMoodysMCPFromEnv wires the adapter from MOODYS_MCP_URL +
// MOODYS_MCP_BEARER. Returns nil when the URL isn't configured so
// callers can do a single nil-check ("Moody's enrichment not
// installed in this deploy") without env-var plumbing.
func NewMoodysMCPFromEnv() *MoodysMCP {
	url := os.Getenv("MOODYS_MCP_URL")
	if url == "" {
		return nil
	}
	return &MoodysMCP{
		client: NewMCPClient(url, os.Getenv("MOODYS_MCP_BEARER"), nil),
	}
}

// Screen calls Moody's `screen_entity` tool. Returns ([], nil) on a
// no-hit response so callers can treat empty as "checked, clean"
// distinctly from a hard error.
func (m *MoodysMCP) Screen(ctx context.Context, name, entityType string) ([]MoodysMatch, error) {
	res, err := m.client.CallTool(ctx, "screen_entity", map[string]interface{}{
		"name":        name,
		"entity_type": entityType,
	})
	if err != nil {
		return nil, err
	}
	text := ToolText(res)
	if text == "" {
		return nil, nil
	}
	var payload struct {
		Matches []MoodysMatch `json:"matches"`
	}
	if err := json.Unmarshal([]byte(text), &payload); err != nil {
		return nil, fmt.Errorf("moodys: parse response: %w", err)
	}
	return payload.Matches, nil
}
