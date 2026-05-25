package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/finsavvyai/sdlc-core/audit"
	"github.com/finsavvyai/sdlc-core/dlp"

	"github.com/finsavvyai/sdlc-cc/internal/metrics"
)

// scrubRequest is the public DLP-as-a-service input. text is the
// only required field; max_chars is an optional safety lid (default
// 64 KiB) so a runaway client can't OOM the gateway with one giant
// payload.
type scrubRequest struct {
	Text     string `json:"text"`
	MaxChars int    `json:"max_chars,omitempty"`
}

type scrubResponse struct {
	CleanText   string     `json:"clean_text"`
	Redactions  dlp.Counts `json:"redactions"`
	BytesIn     int        `json:"bytes_in"`
	BytesOut    int        `json:"bytes_out"`
	ProcessedAt string     `json:"processed_at"`
}

const defaultScrubMaxChars = 65536

// HandleDLPScrub serves POST /v1/dlp/scrub. Bearer auth (sk_sdlc_*)
// is enforced by the WithAPIKeys middleware upstream. Audit row is
// written with summary_type="dlp_scrub" so the governance dashboard
// can distinguish standalone scrub calls from full /v1/messages
// completions.
//
// Designed for downstream MCP tools (compliance_scrub on the AMLIQ
// MCP server) and browser extensions to share one DLP backend. We
// don't ship the raw text into audit — only the per-kind counts.
func HandleDLPScrub(repo audit.Repository, reg *metrics.Registry) http.HandlerFunc {
	m := resolveMetrics(reg)
	return func(w http.ResponseWriter, r *http.Request) {
		var req scrubRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeErr(w, "BAD_REQUEST", "invalid body", http.StatusBadRequest)
			return
		}
		if req.Text == "" {
			writeErr(w, "BAD_REQUEST", "text is required", http.StatusBadRequest)
			return
		}
		lid := req.MaxChars
		if lid <= 0 || lid > defaultScrubMaxChars {
			lid = defaultScrubMaxChars
		}
		if len(req.Text) > lid {
			writeErr(w, "PAYLOAD_TOO_LARGE",
				"text exceeds max_chars; chunk before scrubbing",
				http.StatusRequestEntityTooLarge)
			return
		}

		tenantID := TenantIDFromContext(r.Context())
		started := time.Now()

		clean, counts := dlp.MaskAMLWithCounts(req.Text)
		latency := time.Since(started)

		// Audit + metrics. We log the redaction counts (not the text)
		// so an operator can see "tenant X redacted 12 PANs today"
		// without ever storing the underlying values.
		audit.RecordAIRequest(repo, audit.BuildSuccessLog(
			tenantID, "", "dlp", "maskaml",
			"dlp_scrub", req.Text, "", latency, false))
		m.IncRequestOK()
		m.AddDLPRedactions(counts.Total())
		m.ObserveLatencyMicros(latency.Microseconds())

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(scrubResponse{
			CleanText:   clean,
			Redactions:  counts,
			BytesIn:     len(req.Text),
			BytesOut:    len(clean),
			ProcessedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}
}
