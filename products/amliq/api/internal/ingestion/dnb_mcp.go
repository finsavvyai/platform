package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
)

// DnBMCP fetches D&B corporate-hierarchy data via MCP so AMLIQ can
// resolve UBO chains, parent/subsidiary networks, and DUNS-based
// identity for screening. We hit a single tool — `corporate_hierarchy`
// — and trust D&B for the parent/subsidiary linkage; AMLIQ stitches
// the result into its own customer_corporate_hierarchy table.
type DnBMCP struct {
	client *MCPClient
}

// DnBHierarchy is the trimmed shape we persist. Includes only the
// fields used downstream by case-build + UBO chain rendering. Add
// fields here when a feature actually consumes them — we don't store
// data we don't read.
type DnBHierarchy struct {
	DUNS       string       `json:"duns"`
	LegalName  string       `json:"legal_name"`
	Country    string       `json:"country"`
	ParentDUNS string       `json:"parent_duns"`
	UBOs       []DnBPerson  `json:"ubos"`
	Children   []DnBSubsidiary `json:"children"`
}

type DnBPerson struct {
	Name             string  `json:"name"`
	OwnershipPercent float64 `json:"ownership_percent"`
	Country          string  `json:"country"`
}

type DnBSubsidiary struct {
	DUNS    string `json:"duns"`
	Name    string `json:"name"`
	Country string `json:"country"`
}

// NewDnBMCPFromEnv reads DNB_MCP_URL + DNB_MCP_BEARER. D&B uses an
// X-API-Key header in addition to OAuth on their non-MCP APIs; if
// the MCP endpoint also requires it, the operator sets DNB_API_KEY
// and we send it alongside the bearer.
func NewDnBMCPFromEnv() *DnBMCP {
	url := os.Getenv("DNB_MCP_URL")
	if url == "" {
		return nil
	}
	c := NewMCPClient(url, os.Getenv("DNB_MCP_BEARER"), nil)
	if k := os.Getenv("DNB_API_KEY"); k != "" {
		c.WithHeader("X-API-Key", k)
	}
	return &DnBMCP{client: c}
}

// LookupByDUNS returns the hierarchy rooted at the supplied DUNS. A
// nil result + nil error means "found, but D&B has no enrichment for
// it" — callers persist a stub row so we don't re-query the same
// blank record on every refresh cycle.
func (d *DnBMCP) LookupByDUNS(ctx context.Context, duns string) (*DnBHierarchy, error) {
	res, err := d.client.CallTool(ctx, "corporate_hierarchy",
		map[string]interface{}{"duns": duns})
	if err != nil {
		return nil, err
	}
	text := ToolText(res)
	if text == "" {
		return nil, nil
	}
	var h DnBHierarchy
	if err := json.Unmarshal([]byte(text), &h); err != nil {
		return nil, fmt.Errorf("dnb: parse response: %w", err)
	}
	return &h, nil
}
