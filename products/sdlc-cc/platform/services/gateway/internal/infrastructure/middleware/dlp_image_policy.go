// Per-tenant image-input policy. Claude Team C2 closeout. The
// detector is text-only; it cannot read base64 images embedded in
// Anthropic content blocks. For HIPAA tenants and others without
// an OCR-aware DLP path, the only honest answer is to refuse image
// inputs entirely. This middleware sits inside the chain between
// auth/tenant and the DLP text scanner so blocked requests never
// reach the upstream LLM.
package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
)

// ImagePolicy is the action the gateway takes when a request body
// contains an image content block.
type ImagePolicy string

const (
	ImagePolicyAllow ImagePolicy = "allow"
	ImagePolicyBlock ImagePolicy = "block"
	ImagePolicyWarn  ImagePolicy = "warn"
)

// ImagePolicyLookup is the optional capability a PolicyLookup may
// implement to surface per-tenant image policy. When absent the
// middleware falls back to ImagePolicyAllow.
type ImagePolicyLookup interface {
	ImagePolicy(ctx context.Context, tenantID string) (ImagePolicy, error)
}

// hasImageContentBlock probes the body for Anthropic image content
// blocks. Same probe-only design as hasToolUseBlock — substring
// match instead of JSON parse to keep the hot path cheap.
//
// Common encodings:
//
//	{"type":"image","source":...}
//	{ "type" : "image" , ... }
//
// Note: a request body that legitimately mentions the literal
// string `"type":"image"` in free text would also trigger; we
// accept that false-positive rate because the alternative is full
// JSON parsing on every request.
func hasImageContentBlock(body []byte) bool {
	patterns := [][]byte{
		[]byte(`"type":"image"`),
		[]byte(`"type": "image"`),
		[]byte(`"type" :"image"`),
		[]byte(`"type" : "image"`),
	}
	for _, p := range patterns {
		if bytes.Contains(body, p) {
			return true
		}
	}
	return false
}

// EnforceImagePolicy returns a middleware that consults the tenant
// image policy on every request. It must be mounted BEFORE the DLP
// text scanner so blocked images don't trigger spurious detections.
//
// On block: 422 with Anthropic-shape error envelope so SDKs surface
// the rejection cleanly.
// On warn: passes through but emits a `dlp.image.warn` audit row.
// On allow / nil policy: passthrough.
func (d *DLP) EnforceImagePolicy() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body == nil || r.ContentLength == 0 {
				next.ServeHTTP(w, r)
				return
			}
			policy, ok := d.imagePolicyLookup()
			if !ok {
				next.ServeHTTP(w, r)
				return
			}
			tenant := d.tenantFromCtx(r.Context())
			if tenant == "" {
				next.ServeHTTP(w, r)
				return
			}
			action, err := policy.ImagePolicy(r.Context(), tenant)
			if err != nil || action == "" || action == ImagePolicyAllow {
				next.ServeHTTP(w, r)
				return
			}
			body, err := io.ReadAll(r.Body)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			_ = r.Body.Close()
			r.Body = io.NopCloser(bytes.NewReader(body))
			r.ContentLength = int64(len(body))
			if !hasImageContentBlock(body) {
				next.ServeHTTP(w, r)
				return
			}
			switch action {
			case ImagePolicyBlock:
				d.emitImageAudit(r, "block")
				writeImageBlocked(w)
				return
			case ImagePolicyWarn:
				d.emitImageAudit(r, "warn")
			}
			next.ServeHTTP(w, r)
		})
	}
}

// imagePolicyLookup returns the optional CustomPatternsLookup-style
// capability when the wired Policy implements it. Mirrors the
// pattern used by customPatterns().
func (d *DLP) imagePolicyLookup() (ImagePolicyLookup, bool) {
	if d.Policy == nil {
		return nil, false
	}
	cp, ok := d.Policy.(ImagePolicyLookup)
	return cp, ok
}

// emitImageAudit writes one row per image-policy action. Errors
// are swallowed because the audit signal is non-blocking.
func (d *DLP) emitImageAudit(r *http.Request, verdict string) {
	if d.Audit == nil {
		return
	}
	// Re-reading the body here is safe because we restored it via
	// NopCloser above; the audit body inspection is just for the
	// target_type tag.
	body, _ := io.ReadAll(r.Body)
	if len(body) > 0 {
		r.Body = io.NopCloser(bytes.NewReader(body))
	}
	d.emitAudit(r, "image."+verdict, ActionBlock, nil, body)
}

// writeImageBlocked emits an Anthropic-shape error envelope so
// SDKs parse it cleanly. RFC-7807 here would crash the client.
func writeImageBlocked(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnprocessableEntity)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type": "error",
		"error": map[string]any{
			"type":    "invalid_request_error",
			"message": "image inputs are blocked by tenant DLP policy",
		},
	})
}
