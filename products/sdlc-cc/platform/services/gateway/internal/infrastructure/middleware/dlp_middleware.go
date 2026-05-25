// HTTP middleware that scans inbound prompts (Day 34) and outbound
// responses (Day 35) for PII per the per-tenant policy
// (allow | mask | redact | block). Blocks return 422 +
// application/problem+json (RFC 7807).
package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/audit"
)

// PolicyLookup returns the active DLP action for a tenant. nil
// implementations apply ActionAllow (no-op middleware).
type PolicyLookup interface {
	DLPAction(ctx context.Context, tenantID string) (Action, error)
}

// CustomPatternsLookup is an optional capability a PolicyLookup may
// implement. When present, the middleware loads tenant-defined
// regex patterns alongside the built-in pack so per-tenant
// identifiers get the same DLP treatment as standard classes.
// Claude Team B4.
type CustomPatternsLookup interface {
	CustomPatterns(ctx context.Context, tenantID string) ([]CustomPatternSpec, error)
}

// LegalPresetLookup is an optional capability a PolicyLookup may
// implement. When present and the per-tenant boolean is true, the
// middleware appends the legal-vertical preset (privilege /
// work-product / discovery / identifiers / NDA) to the pattern
// set. See dlp_legal.go for the preset itself. Activated by
// migration 032_dlp_legal_preset.
type LegalPresetLookup interface {
	LegalPreset(ctx context.Context, tenantID string) (bool, error)
}

// DLP bundles the detector + audit hook + policy source.
// MaxBufferedBody caps response buffering for scanning; bigger bodies
// are passed through with X-DLP-Truncated. TenantFromCtx is the
// per-request tenant extractor — wire callers can supply their own so
// this middleware doesn't have to hard-code a context key shape.
type DLP struct {
	Detector        *Detector
	Policy          PolicyLookup
	Audit           DLPAuditAppender
	MaxBufferedBody int64
	TenantFromCtx   func(context.Context) string
}

// DLPAuditAppender lets the middleware emit audit rows without
// coupling to the *audit.Writer concrete type.
type DLPAuditAppender interface {
	AppendAsync(row audit.Row) error
}

// DefaultMaxBufferedBody is 5 MiB — anything bigger streams.
const DefaultMaxBufferedBody = 5 * 1024 * 1024

// NewDLP wires a DLP middleware factory. Pass nil policy to apply
// ActionAllow always (useful in dev).
func NewDLP(detector *Detector, policy PolicyLookup, auditW DLPAuditAppender) *DLP {
	if detector == nil {
		detector = NewDetector()
	}
	return &DLP{Detector: detector, Policy: policy, Audit: auditW, MaxBufferedBody: DefaultMaxBufferedBody}
}

// Inbound scans the request body BEFORE the next handler sees it.
// On block we return 422 + problem+json. On mask/redact we replace
// the body so downstream handlers receive the rewritten bytes. On
// tokenize the body is rewritten with `<TYPE_NNN>` placeholders and
// the reverse map is attached to the request context so Outbound
// can restore the original values in the response.
func (d *DLP) Inbound() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body == nil || r.ContentLength == 0 {
				next.ServeHTTP(w, r)
				return
			}
			body, err := io.ReadAll(r.Body)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			_ = r.Body.Close()

			tenant := d.tenantFromCtx(r.Context())
			action := d.action(r.Context(), tenant)
			extra := d.extraPatterns(r.Context(), tenant)
			ctx := r.Context()
			var rewritten string
			var matches []Match
			if action == ActionTokenize {
				var tokens TokenMap
				rewritten, tokens, matches = d.Detector.tokenizeWith(string(body), extra)
				if len(tokens) > 0 {
					ctx = withTokenMap(ctx, tokens)
				}
			} else {
				var applyErr error
				rewritten, matches, applyErr = d.Detector.ApplyWith(string(body), action, extra)
				if errors.Is(applyErr, ErrBlocked) {
					d.emitAudit(r, "inbound", action, matches, body)
					writeProblemJSON(w, http.StatusUnprocessableEntity,
						"DLP policy blocked request", "block", typeNames(matches))
					return
				}
			}
			if len(matches) > 0 {
				d.emitAudit(r, "inbound", action, matches, body)
			}
			r.Body = io.NopCloser(bytes.NewReader([]byte(rewritten)))
			r.ContentLength = int64(len(rewritten))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Outbound buffers the response, scans it, applies the per-tenant
// policy. Bodies over MaxBufferedBody pass through with a
// `X-DLP-Truncated: 1` header — scanning multi-MB streams inline
// blows the latency budget.
//
// When the inbound leg attached a TokenMap (action=tokenize), the
// outbound leg's first job is to detokenize the response so the
// caller sees the original PII restored. This makes Claude's
// answers usable to the customer while still keeping the LLM
// itself blind to the raw values.
func (d *DLP) Outbound() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rec := &dlpResponseRecorder{
				ResponseWriter: w,
				body:           &bytes.Buffer{},
				cap:            d.MaxBufferedBody,
				status:         http.StatusOK,
			}
			next.ServeHTTP(rec, r)

			if rec.overflow {
				w.Header().Set("X-DLP-Truncated", "1")
				return
			}
			tenant := d.tenantFromCtx(r.Context())
			action := d.action(r.Context(), tenant)
			extra := d.extraPatterns(r.Context(), tenant)

			// Tokenize round-trip: detokenize first, then run the
			// scan on the original-restored text so any *new* PII
			// the model echoed back (not from the inbound) still
			// faces the per-tenant policy.
			body := rec.body.String()
			if action == ActionTokenize {
				if tokens, ok := tokenMapFromCtx(r.Context()); ok {
					body = Detokenize(body, tokens)
				}
				w.WriteHeader(rec.status)
				_, _ = w.Write([]byte(body))
				return
			}

			rewritten, matches, err := d.Detector.ApplyWith(body, action, extra)
			if errors.Is(err, ErrBlocked) {
				d.emitAudit(r, "outbound", action, matches, []byte(body))
				writeProblemJSON(w, http.StatusUnprocessableEntity,
					"DLP policy blocked response", "block", typeNames(matches))
				return
			}
			if len(matches) > 0 {
				d.emitAudit(r, "outbound", action, matches, []byte(body))
			}
			w.WriteHeader(rec.status)
			_, _ = w.Write([]byte(rewritten))
		})
	}
}

// TenantFromCtxOrEmpty exposes the configured tenant extractor to
// callers outside the package (e.g. the anthropic_compat streaming
// path that needs the tenant id without re-importing the chain
// context-key constants). Returns "" when no extractor is wired.
func (d *DLP) TenantFromCtxOrEmpty(ctx context.Context) string {
	if d.TenantFromCtx == nil {
		return ""
	}
	return d.TenantFromCtx(ctx)
}

func (d *DLP) action(ctx context.Context, tenant string) Action {
	if d.Policy == nil || tenant == "" {
		return ActionAllow
	}
	a, err := d.Policy.DLPAction(ctx, tenant)
	if err != nil || a == "" {
		return ActionAllow
	}
	return a
}

// extraPatterns concatenates tenant-defined custom patterns and
// every opted-in vertical preset (legal, finance, healthcare).
// Errors fall through to nil segments so a transient lookup
// failure cannot escalate to dropped traffic.
func (d *DLP) extraPatterns(ctx context.Context, tenant string) []pattern {
	segments := [][]pattern{
		d.customPatterns(ctx, tenant),
		d.legalPatterns(ctx, tenant),
		d.financePatterns(ctx, tenant),
		d.healthcarePatterns(ctx, tenant),
	}
	total := 0
	for _, s := range segments {
		total += len(s)
	}
	if total == 0 {
		return nil
	}
	out := make([]pattern, 0, total)
	for _, s := range segments {
		out = append(out, s...)
	}
	return out
}

// legalPatterns returns the legal-vertical preset when the
// PolicyLookup implements LegalPresetLookup and the tenant has
// opted in. nil result = preset off or capability absent.
func (d *DLP) legalPatterns(ctx context.Context, tenant string) []pattern {
	if d.Policy == nil || tenant == "" {
		return nil
	}
	lp, ok := d.Policy.(LegalPresetLookup)
	if !ok {
		return nil
	}
	on, err := lp.LegalPreset(ctx, tenant)
	if err != nil || !on {
		return nil
	}
	return LegalPatterns()
}

// customPatterns loads tenant-defined regex patterns when the
// PolicyLookup implements the optional CustomPatternsLookup
// capability. nil result = no extras (built-in pack only). Errors
// fall through to nil so a transient lookup failure cannot escalate
// to dropped traffic. Claude Team B4.
func (d *DLP) customPatterns(ctx context.Context, tenant string) []pattern {
	if d.Policy == nil || tenant == "" {
		return nil
	}
	cp, ok := d.Policy.(CustomPatternsLookup)
	if !ok {
		return nil
	}
	specs, err := cp.CustomPatterns(ctx, tenant)
	if err != nil || len(specs) == 0 {
		return nil
	}
	return CompileCustomPatterns(specs)
}

func (d *DLP) emitAudit(r *http.Request, leg string, action Action, matches []Match, body []byte) {
	if d.Audit == nil {
		return
	}
	// Claude Team C1: when the scanned body contains an Anthropic
	// tool_use content block, tag the audit row separately so
	// security admins can filter "PII the model received via tool
	// arguments" from "PII the model echoed in a free-text reply".
	target := "http_request"
	if hasToolUseBlock(body) {
		target = "tool_use"
	}
	_ = d.Audit.AppendAsync(audit.Row{
		ActorType: "user", Action: "dlp." + leg,
		TargetType: target, TargetID: r.URL.Path,
		After: map[string]any{
			"action": string(action), "types": typeNames(matches),
			"matches": len(matches), "leg": leg,
		},
	})
}

// dlpResponseRecorder buffers the downstream body up to cap bytes.
type dlpResponseRecorder struct {
	http.ResponseWriter
	body     *bytes.Buffer
	cap      int64
	status   int
	overflow bool
}

func (r *dlpResponseRecorder) WriteHeader(status int) { r.status = status }

func (r *dlpResponseRecorder) Write(b []byte) (int, error) {
	if r.overflow {
		return r.ResponseWriter.Write(b)
	}
	if int64(r.body.Len()+len(b)) > r.cap {
		r.overflow = true
		// Flush whatever we held back, then pass through.
		r.ResponseWriter.WriteHeader(r.status)
		if r.body.Len() > 0 {
			_, _ = r.ResponseWriter.Write(r.body.Bytes())
		}
		return r.ResponseWriter.Write(b)
	}
	return r.body.Write(b)
}

func writeProblemJSON(w http.ResponseWriter, status int, detail, action string, types []string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type": "https://sdlc.ai/problems/dlp-block", "title": "DLP policy violation",
		"status": status, "detail": detail, "action": action, "piiTypes": types,
	})
}

func typeNames(matches []Match) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		if !seen[m.Type] {
			seen[m.Type] = true
			out = append(out, m.Type)
		}
	}
	return out
}

// tenantFromCtx delegates to the configured extractor; if none is
// configured (e.g. tests construct a DLP literal), fall back to the
// legacy string key for compatibility with older callers.
func (d *DLP) tenantFromCtx(ctx context.Context) string {
	if d.TenantFromCtx != nil {
		return d.TenantFromCtx(ctx)
	}
	v, _ := ctx.Value("tenant_id").(string)
	return v
}
