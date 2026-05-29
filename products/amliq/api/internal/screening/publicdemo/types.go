// Package publicdemo implements the POST /api/v1/screen/public-demo
// endpoint backed by static JSON fixtures under samples/screen/.
//
// It is a self-contained, in-process screening path used for marketing
// demos and offline integration tests. The real engine cascade
// (Exact + Fuzzy + Phonetic + Token) from internal/screening is reused;
// no database, no embeddings, no graph.
//
// Audit: every request emits exactly one
//   event = "aml.screen.public_demo"
// audit record via the configured Auditor.
package publicdemo

// Request is the public-demo request body.
type Request struct {
	Name      string   `json:"name"`
	Lists     []string `json:"lists,omitempty"`
	PEP       bool     `json:"pep,omitempty"`
	Threshold float64  `json:"threshold,omitempty"`
}

// LayerResult is the per-layer evidence surfaced to API clients.
type LayerResult struct {
	Layer   string  `json:"layer"`
	Score   float64 `json:"score"`
	Matched string  `json:"matched"`
}

// Match is a single screening hit returned to the caller.
type Match struct {
	EntityID   string        `json:"entityId"`
	EntityName string        `json:"entityName"`
	Confidence float64       `json:"confidence"`
	Lists      []string      `json:"lists"`
	Layers     []LayerResult `json:"layers"`
	PEPStatus  PEPStatus     `json:"pepStatus"`
}

// PEPStatus carries optional PEP enrichment per match.
// Status is one of: "none", "match", "alias_match".
type PEPStatus struct {
	Status   string `json:"status"`
	Position string `json:"position,omitempty"`
	Country  string `json:"country,omitempty"`
	Tier     string `json:"tier,omitempty"`
}

// PEPNone is the default zero-value status for non-PEP matches.
func PEPNone() PEPStatus { return PEPStatus{Status: "none"} }

// Response is the public-demo response body.
type Response struct {
	Query      string  `json:"query"`
	Matches    []Match `json:"matches"`
	RiskLevel  string  `json:"riskLevel"`
	LatencyMs  int64   `json:"latencyMs"`
	ScreenedAt string  `json:"screenedAt"`
}

// FixtureEntry is one record inside a sanctions/PEP list fixture file.
type FixtureEntry struct {
	EntityID    string   `json:"entity_id"`
	Type        string   `json:"type"`
	PrimaryName string   `json:"primary_name"`
	Aliases     []string `json:"aliases"`
	Country     string   `json:"country"`
	Position    string   `json:"position,omitempty"`
	Tier        string   `json:"tier,omitempty"`
}

// FixtureList is one sanctions/PEP list fixture file.
type FixtureList struct {
	ListID  string         `json:"list_id"`
	Name    string         `json:"name"`
	Version string         `json:"version"`
	Source  string         `json:"source"`
	Entries []FixtureEntry `json:"entries"`
}

// ErrorResponse is the shape returned for 4xx/5xx errors.
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code"`
	Message string `json:"message"`
}
