// Compliance — data flow descriptor.
//
// GET /compliance/data-flow
//
// Returns a static-but-versioned JSON describing how user data flows
// through the platform: ingest → embed → store → query → respond →
// audit. The body is stable per release; the SHA in the response
// header (`X-Data-Flow-Sha`) lets auditors detect changes between
// reports.
//
// Day 32 of the production-ready roadmap.
package compliance

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"
)

// DataFlow is the shape returned. Each Stage has inputs, transforms,
// outputs, and the storage location of the result.
type DataFlow struct {
	Version     string      `json:"version"`
	GeneratedAt time.Time   `json:"generated_at"`
	Stages      []DataStage `json:"stages"`
}

// DataStage is one step in the pipeline.
type DataStage struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Inputs      []string `json:"inputs"`
	Outputs     []string `json:"outputs"`
	Storage     string   `json:"storage,omitempty"`
	Encryption  string   `json:"encryption,omitempty"`
	Retention   string   `json:"retention,omitempty"`
}

// canonicalDataFlow is the documented data flow at this commit. Bump
// Version when stages change so the SHA changes too.
var canonicalDataFlow = DataFlow{
	Version: "1.0.0",
	Stages: []DataStage{
		{
			Name:        "ingest",
			Description: "User submits a prompt or document via the gateway.",
			Inputs:      []string{"prompt_text", "document_bytes"},
			Outputs:     []string{"raw_request"},
			Storage:     "ephemeral (request scope)",
			Encryption:  "TLS 1.2+ in transit",
		},
		{
			Name:        "dlp_scan",
			Description: "Inbound DLP scans for PII (SSN, credit card, etc.) per tenant policy.",
			Inputs:      []string{"raw_request"},
			Outputs:     []string{"scrubbed_request", "dlp_event"},
			Storage:     "dlp_events table (RLS-isolated)",
			Encryption:  "Postgres TDE",
		},
		{
			Name:        "embed",
			Description: "Documents are chunked and embedded into pgvector.",
			Inputs:      []string{"scrubbed_request"},
			Outputs:     []string{"embedding_rows"},
			Storage:     "embeddings table (pgvector)",
			Encryption:  "Postgres TDE",
			Retention:   "per tenant retention policy",
		},
		{
			Name:        "llm_call",
			Description: "Routed to provider (OpenAI/Anthropic/Bedrock) via llm-gateway.",
			Inputs:      []string{"scrubbed_request", "retrieved_chunks"},
			Outputs:     []string{"completion_text", "spend_event"},
			Storage:     "spend_events table",
			Encryption:  "TLS 1.2+ provider-side; Postgres TDE local",
		},
		{
			Name:        "outbound_dlp",
			Description: "Outbound DLP scans completion text for data exfiltration.",
			Inputs:      []string{"completion_text"},
			Outputs:     []string{"final_response"},
			Storage:     "dlp_events table (block decisions only)",
			Encryption:  "Postgres TDE",
		},
		{
			Name:        "audit",
			Description: "Every action writes an append-only audit log row.",
			Inputs:      []string{"request_metadata", "actor_id", "action"},
			Outputs:     []string{"audit_row"},
			Storage:     "audit_logs table (append-only, legal-hold aware)",
			Encryption:  "Postgres TDE; row hashes signed",
			Retention:   "tenant policy or legal-hold (whichever is longer)",
		},
	},
}

// DataFlowHandler returns the http.HandlerFunc.
func DataFlowHandler() http.HandlerFunc {
	body := canonicalDataFlow
	body.GeneratedAt = time.Now().UTC()
	// Compute the SHA over the JSON of the canonical flow (without
	// GeneratedAt, which would change every call).
	hashable, _ := json.Marshal(struct {
		Version string      `json:"version"`
		Stages  []DataStage `json:"stages"`
	}{Version: body.Version, Stages: body.Stages})
	sum := sha256.Sum256(hashable)
	sha := hex.EncodeToString(sum[:])

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Data-Flow-Sha", sha)
		w.Header().Set("X-Schema-Version", SchemaVersion)
		out := body
		out.GeneratedAt = time.Now().UTC()
		writeComplianceJSON(w, http.StatusOK, out)
	}
}
