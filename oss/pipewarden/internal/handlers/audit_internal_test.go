package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const testInternalAuditToken = "test-secret-do-not-use"

func sign(body, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func newIngestRequest(t *testing.T, body string, sig string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/audit/internal", strings.NewReader(body))
	if sig != "" {
		req.Header.Set(HeaderInternalAuditSig, sig)
	}
	return req
}

func TestIngestInternalAudit_TokenUnset_503(t *testing.T) {
	t.Setenv(EnvInternalAuditToken, "")

	h := newTestHandlers(t)
	w := httptest.NewRecorder()
	h.IngestInternalAudit(w, newIngestRequest(t, `{"action":"a","source":"s"}`, "irrelevant"))

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when token is unset, got %d", w.Code)
	}
}

func TestIngestInternalAudit_MissingSignature_401(t *testing.T) {
	t.Setenv(EnvInternalAuditToken, testInternalAuditToken)

	h := newTestHandlers(t)
	w := httptest.NewRecorder()
	h.IngestInternalAudit(w, newIngestRequest(t, `{"action":"a","source":"s"}`, ""))

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when signature header is missing, got %d", w.Code)
	}
}

func TestIngestInternalAudit_BadSignature_401(t *testing.T) {
	t.Setenv(EnvInternalAuditToken, testInternalAuditToken)

	body := `{"action":"a","source":"s"}`
	wrong := sign(body, "wrong-secret")

	h := newTestHandlers(t)
	w := httptest.NewRecorder()
	h.IngestInternalAudit(w, newIngestRequest(t, body, wrong))

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with mismatched signature, got %d", w.Code)
	}
}

func TestIngestInternalAudit_MalformedJSON_400(t *testing.T) {
	t.Setenv(EnvInternalAuditToken, testInternalAuditToken)

	body := `{not json`
	h := newTestHandlers(t)
	w := httptest.NewRecorder()
	h.IngestInternalAudit(w, newIngestRequest(t, body, sign(body, testInternalAuditToken)))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on malformed JSON, got %d", w.Code)
	}
}

func TestIngestInternalAudit_MissingFields_400(t *testing.T) {
	t.Setenv(EnvInternalAuditToken, testInternalAuditToken)

	body := `{"action":"","source":""}`
	h := newTestHandlers(t)
	w := httptest.NewRecorder()
	h.IngestInternalAudit(w, newIngestRequest(t, body, sign(body, testInternalAuditToken)))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on empty action/source, got %d", w.Code)
	}
}

func TestIngestInternalAudit_WrongMethod_405(t *testing.T) {
	t.Setenv(EnvInternalAuditToken, testInternalAuditToken)

	h := newTestHandlers(t)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/internal", nil)
	h.IngestInternalAudit(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for GET, got %d", w.Code)
	}
}

func TestIngestInternalAudit_HappyPath_PersistsRow(t *testing.T) {
	t.Setenv(EnvInternalAuditToken, testInternalAuditToken)

	h := newTestHandlers(t)
	body := `{"action":"flake_spike","source":"weekly-flakestress","severity":"high","details":{"package":"./internal/handlers"}}`
	w := httptest.NewRecorder()
	h.IngestInternalAudit(w, newIngestRequest(t, body, sign(body, testInternalAuditToken)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body=%s)", w.Code, w.Body.String())
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["status"] != "accepted" {
		t.Fatalf("unexpected response body: %v", resp)
	}

	rows, err := h.db.ListAuditLog("internal.flake_spike", "weekly-flakestress", 10, 0)
	if err != nil {
		t.Fatalf("ListAuditLog: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 row written, got %d", len(rows))
	}
	row := rows[0]
	if row.Action != "internal.flake_spike" {
		t.Errorf("action: got %q, want %q", row.Action, "internal.flake_spike")
	}
	if row.Actor != "internal" {
		t.Errorf("actor: got %q, want %q", row.Actor, "internal")
	}
	if row.ResourceType != "ci" {
		t.Errorf("resource_type: got %q, want %q", row.ResourceType, "ci")
	}
	if row.Details["severity"] != "high" || row.Details["package"] != "./internal/handlers" {
		t.Errorf("details: %v", row.Details)
	}
}

func TestIngestInternalAudit_OversizeBody_400(t *testing.T) {
	t.Setenv(EnvInternalAuditToken, testInternalAuditToken)

	big := bytes.Repeat([]byte("x"), internalAuditMaxBody+10)
	body := string(big)
	h := newTestHandlers(t)
	w := httptest.NewRecorder()
	h.IngestInternalAudit(w, newIngestRequest(t, body, sign(body, testInternalAuditToken)))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on oversized body, got %d", w.Code)
	}
}
