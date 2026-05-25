package handlers

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGenerateRawKeyFormat(t *testing.T) {
	for i := 0; i < 5; i++ {
		k, err := generateRawKey()
		if err != nil {
			t.Fatalf("gen: %v", err)
		}
		if !strings.HasPrefix(k, "pw_") {
			t.Fatalf("missing prefix: %q", k)
		}
		// 32 bytes -> 43 chars base64 url-safe no-pad + 3 prefix = 46
		if len(k) != 46 {
			t.Fatalf("len=%d, want 46: %q", len(k), k)
		}
	}
}

func TestHashKeyDeterministic(t *testing.T) {
	h1 := hashKey("pw_abc")
	h2 := hashKey("pw_abc")
	if h1 != h2 {
		t.Fatalf("non-deterministic hash: %q vs %q", h1, h2)
	}
	if len(h1) != 64 {
		t.Fatalf("hash len=%d, want 64", len(h1))
	}
	if hashKey("pw_abc") == hashKey("pw_def") {
		t.Fatal("collision on distinct inputs")
	}
}

func TestGenerateAPIKeyHandlerHappy(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("POST", "/api/v1/connections/demo/apikey", nil)
	w := httptest.NewRecorder()
	h.GenerateAPIKey(w, req)
	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "pw_") {
		t.Fatalf("body missing key: %s", w.Body.String())
	}
}

func TestGenerateAPIKeyWrongMethod(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/connections/demo/apikey", nil)
	w := httptest.NewRecorder()
	h.GenerateAPIKey(w, req)
	if w.Code != 405 {
		t.Fatalf("method: %d", w.Code)
	}
}

func TestGenerateAPIKeyMissingName(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("POST", "/api/v1/connections//apikey", nil)
	w := httptest.NewRecorder()
	h.GenerateAPIKey(w, req)
	if w.Code != 400 {
		t.Fatalf("missing name: %d", w.Code)
	}
}

func TestRevokeAPIKeyHappy(t *testing.T) {
	h, db := newTestHandlersDB(t)
	// Seed an apikey first so revoke has something to delete.
	_ = db.CreateAPIKey("demo", hashKey("pw_test"))
	req := httptest.NewRequest("DELETE", "/api/v1/connections/demo/apikey", nil)
	w := httptest.NewRecorder()
	h.RevokeAPIKey(w, req)
	if w.Code != 200 {
		t.Fatalf("revoke: %d body=%s", w.Code, w.Body.String())
	}
}

func TestRevokeAPIKeyWrongMethod(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/connections/demo/apikey", nil)
	w := httptest.NewRecorder()
	h.RevokeAPIKey(w, req)
	if w.Code != 405 {
		t.Fatalf("method: %d", w.Code)
	}
}

func TestRevokeAPIKeyMissingName(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("DELETE", "/api/v1/connections//apikey", nil)
	w := httptest.NewRecorder()
	h.RevokeAPIKey(w, req)
	if w.Code != 400 {
		t.Fatalf("missing name: %d", w.Code)
	}
}

// Contract of ValidateEmbedAPIKey: returns (name, present, ok).
//   - No ?apikey=:        ("",   false, true)  — caller falls through to other auth
//   - ?apikey=invalid:    ("",   true,  false) — handler wrote 401, caller stops
//   - ?apikey=valid:      (name, true,  true)  — auth passed via API key
func TestValidateEmbedAPIKeyAbsent(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/embed/findings", nil)
	w := httptest.NewRecorder()
	name, present, ok := h.ValidateEmbedAPIKey(w, req)
	if name != "" || present || !ok {
		t.Fatalf("absent: name=%q present=%v ok=%v", name, present, ok)
	}
}

func TestValidateEmbedAPIKeyValid(t *testing.T) {
	h, db := newTestHandlersDB(t)
	raw := "pw_valid_test_key"
	_ = db.CreateAPIKey("demo", hashKey(raw))
	req := httptest.NewRequest("GET", "/api/v1/embed/findings?apikey="+raw, nil)
	w := httptest.NewRecorder()
	name, present, ok := h.ValidateEmbedAPIKey(w, req)
	if name != "demo" || !present || !ok {
		t.Fatalf("valid: name=%q present=%v ok=%v", name, present, ok)
	}
}

func TestValidateEmbedAPIKeyInvalid(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/embed/findings?apikey=pw_garbage", nil)
	w := httptest.NewRecorder()
	name, present, ok := h.ValidateEmbedAPIKey(w, req)
	if name != "" || !present || ok {
		t.Fatalf("invalid: name=%q present=%v ok=%v", name, present, ok)
	}
	if w.Code != 401 {
		t.Fatalf("invalid key should 401: %d", w.Code)
	}
}
