// Package llm provides the /v1/chat handler that combines
//   - per-tenant 402 hard-cap pre-flight via spend.Check, and
//   - a real LLM provider call (Anthropic by default), and
//   - per-call spend recording via the existing spend.Tracker.
//
// BEAT-PLAN S1.2 / INTEGRATION-DEBT Days 28-29, 49. This is the
// callsite that flips Day 49 (Provider interface) and Days 28-29
// (spend tracking + 402 cap) from "primitive only" to wired.
package llm

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/routing"
	domspend "github.com/sdlc-ai/platform/services/gateway/internal/domain/spend"
	infllm "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/llm"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/record"
	infspend "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/spend"
)

// Deps wires the handler. Provider is required; the spend trio is
// optional so dev (no Postgres / no AUDIT key) still serves /v1/chat.
type Deps struct {
	Provider  infllm.Provider
	Tracker   *infspend.Tracker
	Usage     UsageReader
	Limits    LimitReader
	TenantCtx func(ctx context.Context) (uuid.UUID, bool)
	UserCtx   func(ctx context.Context) (uuid.UUID, bool)
	Now       func() time.Time
	// RoutingPolicy is the per-tenant tier→model mapping (Day-50).
	// Nil means no auto-routing — the caller's req.Model is used
	// verbatim, preserving prior behaviour.
	RoutingPolicy *routing.Policy
	// Recorder captures prompt and response metadata into session_recordings
	// when RecordingEnabled returns true for the request's tenant.
	// Nil disables recording silently (dev / no DB).
	Recorder record.Recorder
	// RecordingEnabled decides whether a given tenant has opted into
	// session recording. Nil means recording is always skipped even when
	// Recorder is wired.
	RecordingEnabled func(ctx context.Context, tenantID uuid.UUID) bool
}

// UsageReader returns month-to-date USD cents for a tenant. The
// concrete impl is *infspend.UsageReader; the interface lets tests
// inject canned numbers.
type UsageReader interface {
	MonthToDateCents(ctx context.Context, tenantID uuid.UUID) (int64, error)
}

// LimitReader returns the active LimitConfig for a tenant. Concrete
// impl is *infspend.LimitRepo.
type LimitReader interface {
	ForTenant(ctx context.Context, tenantID uuid.UUID) (domspend.LimitConfig, error)
}

// chatRequest is the wire shape POSTed to /v1/chat.
type chatRequest struct {
	Model       string             `json:"model"`
	Messages    []infllm.Message   `json:"messages"`
	MaxTokens   int                `json:"max_tokens"`
	Temperature float32            `json:"temperature,omitempty"`
}

// Chat returns the /v1/chat handler. Returns 402 + RFC-7807 JSON when
// the tenant is over its monthly hard cap; 503 on provider failure.
func Chat(deps Deps) http.HandlerFunc {
	if deps.Provider == nil {
		panic("llm.Chat: Provider required")
	}
	if deps.Now == nil {
		deps.Now = time.Now
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req chatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, errorBody("invalid_request", err.Error()))
			return
		}
		tenantID, hasTenant := deps.tenantOrZero(r.Context())
		if hasTenant {
			if v := preCheckSpend(r.Context(), deps, tenantID); v != nil {
				writeJSON(w, http.StatusPaymentRequired, v)
				return
			}
		}
		// Day-50: pick the model when the caller didn't pin one.
		// X-Model-Tier and X-Model-Override headers feed directly into
		// the policy; an explicit body req.Model is treated as the
		// strongest override. Fallback chain still picks the vendor.
		model := selectModel(r, req, deps, hasTenant, tenantID)
		resp, err := deps.Provider.Generate(r.Context(), infllm.Request{
			Model:       model,
			Messages:    req.Messages,
			MaxTokens:   req.MaxTokens,
			Temperature: req.Temperature,
		})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, errorBody("upstream_error", err.Error()))
			return
		}
		recordSpend(r.Context(), deps, tenantID, resp)
		if hasTenant {
			captureRecording(r, deps, tenantID, req, resp)
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// selectModel runs the Day-50 routing pipeline:
//
//  1. body req.Model wins outright (explicit caller intent).
//  2. X-Model-Override header wins next (admin pin to a specific id).
//  3. X-Model-Tier header normalised → tier, else Classify(prompt,
//     attachments, role).
//  4. Policy.Decide(tier, headroom, "") returns the concrete model id.
//
// When deps.RoutingPolicy is nil the function returns req.Model so
// behaviour matches the pre-Day-50 handler exactly.
func selectModel(r *http.Request, req chatRequest, deps Deps, hasTenant bool, tenantID uuid.UUID) string {
	if req.Model != "" {
		return req.Model
	}
	if deps.RoutingPolicy == nil {
		return ""
	}
	override := r.Header.Get("X-Model-Override")
	tier := routing.NormalizeHeaderTier(r.Header.Get("X-Model-Tier"))
	if tier == "" {
		// Last user message is the prompt; no need to scan the full
		// history. Empty if the caller skipped messages — Classify
		// returns a sensible default tier in that case.
		var prompt string
		if n := len(req.Messages); n > 0 {
			prompt = req.Messages[n-1].Content
		}
		role, _ := r.Context().Value("user_role").(string)
		tier = routing.Classify(prompt, 0, role)
	}
	headroom := int64(-1) // -1 = unknown -> Decide treats as plenty
	if hasTenant && deps.Usage != nil && deps.Limits != nil {
		if cfg, err := deps.Limits.ForTenant(r.Context(), tenantID); err == nil {
			if used, err := deps.Usage.MonthToDateCents(r.Context(), tenantID); err == nil {
				hard := cfg.MonthlyUSDCents
				if cfg.HardCapPct > 0 && cfg.HardCapPct != 100 {
					hard = cfg.MonthlyUSDCents * int64(cfg.HardCapPct) / 100
				}
				headroom = hard - used
			}
		}
	}
	return deps.RoutingPolicy.Decide(tier, headroom, override)
}

// preCheckSpend returns nil when the tenant has budget remaining or no
// limit is configured, otherwise a 402 RFC-7807 body.
func preCheckSpend(ctx context.Context, deps Deps, tenantID uuid.UUID) any {
	if deps.Limits == nil || deps.Usage == nil {
		return nil
	}
	cfg, err := deps.Limits.ForTenant(ctx, tenantID)
	if err != nil {
		if errors.Is(err, infspend.ErrNoLimit) {
			return nil
		}
		return errorBody("limit_lookup_failed", err.Error())
	}
	used, err := deps.Usage.MonthToDateCents(ctx, tenantID)
	if err != nil {
		return errorBody("usage_lookup_failed", err.Error())
	}
	v := domspend.Check(ctx, cfg, used)
	if v.OverHardCap {
		return map[string]any{
			"type":            "https://sdlc.ai/errors/hard-cap-exceeded",
			"title":           "spend hard cap exceeded",
			"status":          http.StatusPaymentRequired,
			"used_cents":      v.UsedCents,
			"budget_cents":    v.BudgetCents,
			"warn_at_cents":   v.WarnAtCents,
		}
	}
	return nil
}

// recordSpend forwards the actual token counts to the tracker so the
// next pre-check sees them. Tenant=zero (e.g. dev bypass) skips
// recording so we never insert tenant_id=NULL into spend_events.
func recordSpend(_ context.Context, deps Deps, tenantID uuid.UUID, resp *infllm.Response) {
	if deps.Tracker == nil || tenantID == uuid.Nil || resp == nil {
		return
	}
	ev := infspend.Event{
		TenantID:         tenantID,
		Provider:         resp.Provider,
		Model:            resp.Model,
		PromptTokens:     resp.PromptTokens,
		CompletionTokens: resp.CompletionTokens,
		OccurredAt:       deps.Now(),
	}
	_ = deps.Tracker.Record(ev)
}

// tenantOrZero pulls the tenant id from the context using the typed
// extractor when available; falls back to the legacy string key so
// LOCAL_AUTH_BYPASS-mode requests still work in dev.
func (d Deps) tenantOrZero(ctx context.Context) (uuid.UUID, bool) {
	if d.TenantCtx != nil {
		if id, ok := d.TenantCtx(ctx); ok {
			return id, true
		}
	}
	if v, ok := ctx.Value("tenant_id").(uuid.UUID); ok && v != uuid.Nil {
		return v, true
	}
	return uuid.Nil, false
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func errorBody(code, msg string) map[string]any {
	return map[string]any{
		"type":   "https://sdlc.ai/errors/" + code,
		"title":  code,
		"detail": msg,
	}
}

// Mount returns a chi.Router wrapping the chat handler so callers can
// `r.Mount("/v1/chat", llm.Mount(deps))`.
func Mount(deps Deps) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /", Chat(deps))
	return mux
}

