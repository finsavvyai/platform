package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
)

// EnvInternalAuditToken names the shared HMAC secret used to authenticate
// inbound calls to POST /api/v1/audit/internal. When unset the endpoint
// returns 503 so misconfiguration is loud, not silent.
const EnvInternalAuditToken = "PIPEWARDEN_INTERNAL_AUDIT_TOKEN"

// HeaderInternalAuditSig is the request header carrying the HMAC-SHA256
// signature of the request body, hex-encoded with a `sha256=` prefix
// (mirrors GitHub's webhook convention so existing tooling can sign).
const HeaderInternalAuditSig = "X-Pipewarden-Audit-Signature"

// internalAuditMaxBody caps the request body so a hostile sender cannot
// exhaust memory. 64 KiB is well above the size of any flake spike or
// CI job summary we expect to ingest.
const internalAuditMaxBody = 64 * 1024

// internalAuditPrefix namespaces every inbound action under `internal.`
// so dashboards can distinguish self-instrumented events from operator
// or system writes. The caller's "action" field is appended after this
// prefix; the prefix cannot be overridden.
const internalAuditPrefix = "internal."

// internalAuditEvent is the wire shape for inbound audit events.
type internalAuditEvent struct {
	Action   string            `json:"action"`
	Source   string            `json:"source"`
	Severity string            `json:"severity"`
	Details  map[string]string `json:"details,omitempty"`
}

// IngestInternalAudit handles POST /api/v1/audit/internal — an inbound
// hook that lets trusted internal automation (CI jobs, scheduled
// workers) deposit audit events into pipewarden's own audit log without
// going through the outbound webhooks.AuditSender path.
//
// Auth: HMAC-SHA256 of the raw request body keyed by the shared secret
// in PIPEWARDEN_INTERNAL_AUDIT_TOKEN. Compared in constant time. The
// endpoint refuses the call (503) when the token is unset so a
// half-configured deployment cannot silently accept anonymous writes.
func (h *Handlers) IngestInternalAudit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := os.Getenv(EnvInternalAuditToken)
	if token == "" {
		jsonError(w, "internal audit ingest is disabled", http.StatusServiceUnavailable)
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, internalAuditMaxBody))
	if err != nil {
		jsonError(w, "request body too large or unreadable", http.StatusBadRequest)
		return
	}

	if err := verifyInternalAuditSignature(r.Header.Get(HeaderInternalAuditSig), token, body); err != nil {
		jsonError(w, "signature mismatch", http.StatusUnauthorized)
		return
	}

	var ev internalAuditEvent
	if err := json.Unmarshal(body, &ev); err != nil {
		jsonError(w, "malformed JSON", http.StatusBadRequest)
		return
	}

	action := strings.TrimSpace(ev.Action)
	source := strings.TrimSpace(ev.Source)
	if action == "" || source == "" {
		jsonError(w, "action and source are required", http.StatusBadRequest)
		return
	}

	details := map[string]string{}
	for k, v := range ev.Details {
		details[k] = v
	}
	if ev.Severity != "" {
		details["severity"] = ev.Severity
	}

	if err := h.db.AppendAuditLog(internalAuditPrefix+action, "internal", source, "ci", details); err != nil {
		h.logger.Errorw("internal audit ingest failed to persist", "error", err, "action", action, "source", source)
		jsonError(w, "failed to persist audit event", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"status": "accepted"})
}

// verifyInternalAuditSignature parses an HMAC header in the form
// `sha256=<hex>` and constant-time-compares it to the expected signature.
// Returns a non-nil error on any mismatch; the caller should not leak
// the specific failure reason to the client.
func verifyInternalAuditSignature(header, secret string, body []byte) error {
	if header == "" {
		return errors.New("missing signature header")
	}
	const prefix = "sha256="
	if !strings.HasPrefix(header, prefix) {
		return errors.New("unsupported signature scheme")
	}
	got, err := hex.DecodeString(strings.TrimPrefix(header, prefix))
	if err != nil {
		return errors.New("malformed signature hex")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := mac.Sum(nil)

	if !hmac.Equal(got, expected) {
		return errors.New("signature mismatch")
	}
	return nil
}
