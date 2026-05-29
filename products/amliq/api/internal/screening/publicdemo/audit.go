package publicdemo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
	"time"
)

// AuditRecord is the single audit row written per public-demo request.
// Shape conforms to AMLIQ CLAUDE.md: ts, actor_id, event, resource,
// decision, reason, meta. `reason` is a stable PII-free code.
type AuditRecord struct {
	TS       string                 `json:"ts"`
	ActorID  string                 `json:"actor_id"`
	Event    string                 `json:"event"`
	Resource string                 `json:"resource"`
	Decision string                 `json:"decision"`
	Reason   string                 `json:"reason"`
	Meta     map[string]interface{} `json:"meta"`
}

// Auditor emits exactly one AuditRecord per public-demo decision.
// Emit MUST return nil on success; any non-nil error causes the handler
// to fail the response (per AMLIQ audit policy).
type Auditor interface {
	Emit(ctx context.Context, rec AuditRecord) error
}

// WriterAuditor is the default fallback Auditor — it writes a single
// JSON line per record to the configured io.Writer. Safe for
// concurrent use.
type WriterAuditor struct {
	mu sync.Mutex
	w  io.Writer
}

// NewWriterAuditor returns a WriterAuditor that writes to `w`. nil w
// falls back to os.Stdout so audit emission never silently no-ops.
func NewWriterAuditor(w io.Writer) *WriterAuditor {
	if w == nil {
		w = os.Stdout
	}
	return &WriterAuditor{w: w}
}

// Emit serialises the record as one JSON line.
func (a *WriterAuditor) Emit(_ context.Context, rec AuditRecord) error {
	b, err := json.Marshal(rec)
	if err != nil {
		return fmt.Errorf("marshal audit: %w", err)
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if _, err := a.w.Write(append(b, '\n')); err != nil {
		return fmt.Errorf("write audit: %w", err)
	}
	return nil
}

// buildAuditRecord constructs the per-request audit row from the
// handler's response and timing data.
//   - resource: stable hash slot ("public-demo:<query-hash-prefix>") so
//     no plaintext name appears in audit storage.
//   - decision: maps risk_level → block (high) / review (medium|low) /
//     clear.
//   - reason: stable PII-free code.
func buildAuditRecord(resp Response, latencyMs int64, threshold float64, lists []string, pep bool) AuditRecord {
	dec := decisionFor(resp.RiskLevel)
	reason := reasonFor(resp.Matches, resp.RiskLevel)
	return AuditRecord{
		TS:       time.Now().UTC().Format(time.RFC3339Nano),
		ActorID:  "public-demo",
		Event:    "aml.screen.public_demo",
		Resource: "public-demo:" + queryHashSlot(resp.Query),
		Decision: dec,
		Reason:   reason,
		Meta: map[string]interface{}{
			"matchCount":   len(resp.Matches),
			"riskLevel":    resp.RiskLevel,
			"latencyMs":    latencyMs,
			"threshold":    threshold,
			"lists":        lists,
			"pepRequested": pep,
		},
	}
}

func decisionFor(risk string) string {
	switch risk {
	case "high":
		return "block"
	case "medium", "low":
		return "review"
	default:
		return "clear"
	}
}

func reasonFor(matches []Match, risk string) string {
	if len(matches) == 0 {
		return "no_match"
	}
	if risk == "high" {
		return "sanctions_match"
	}
	return "candidate_match"
}

// queryHashSlot returns a short, deterministic, PII-free slot for the
// audit resource. It deliberately drops everything but the input
// length — enough to bucket requests for rate analysis without leaking
// the queried name.
func queryHashSlot(q string) string {
	return fmt.Sprintf("len_%d", len(q))
}
