package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestJoinWaitlist_Success(t *testing.T) {
	h := newTestHandlers(t)

	body := `{"email":"first@example.com","tier":"team","company":"Acme"}`
	req := httptest.NewRequest(http.MethodPost, "/api/waitlist", strings.NewReader(body))
	rec := httptest.NewRecorder()

	h.JoinWaitlist(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status: got %d want 202; body=%s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["status"] != "queued" {
		t.Errorf("status: got %v", resp["status"])
	}
	if resp["tier"] != "team" {
		t.Errorf("tier: got %v", resp["tier"])
	}

	count, err := h.db.CountWaitlistSignups()
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 row, got %d", count)
	}
}

func TestJoinWaitlist_DefaultTier(t *testing.T) {
	h := newTestHandlers(t)

	body := `{"email":"second@example.com"}`
	req := httptest.NewRequest(http.MethodPost, "/api/waitlist", strings.NewReader(body))
	rec := httptest.NewRecorder()

	h.JoinWaitlist(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status: got %d", rec.Code)
	}
	var resp map[string]any
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	if resp["tier"] != "starter" {
		t.Errorf("default tier: got %v", resp["tier"])
	}
}

func TestJoinWaitlist_RejectsInvalidEmail(t *testing.T) {
	h := newTestHandlers(t)

	cases := []struct {
		name string
		body string
	}{
		{"empty", `{"email":""}`},
		{"no_at", `{"email":"plain"}`},
		{"missing", `{"tier":"team"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/waitlist", strings.NewReader(tc.body))
			rec := httptest.NewRecorder()
			h.JoinWaitlist(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status: got %d want 400; body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestJoinWaitlist_RejectsBadJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/waitlist", bytes.NewReader([]byte("not-json")))
	rec := httptest.NewRecorder()
	h.JoinWaitlist(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d", rec.Code)
	}
}

func TestJoinWaitlist_RejectsNonPOST(t *testing.T) {
	h := newTestHandlers(t)
	for _, m := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		t.Run(m, func(t *testing.T) {
			req := httptest.NewRequest(m, "/api/waitlist", nil)
			rec := httptest.NewRecorder()
			h.JoinWaitlist(rec, req)
			if rec.Code != http.StatusMethodNotAllowed {
				t.Errorf("%s status: got %d want 405", m, rec.Code)
			}
		})
	}
}
