package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSecurityTxt_RFC9116Fields(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/.well-known/security.txt", nil)
	w := httptest.NewRecorder()
	h.SecurityTxt(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	body := w.Body.String()
	for _, required := range []string{"Contact:", "Expires:", "Canonical:", "Preferred-Languages:"} {
		if !strings.Contains(body, required) {
			t.Errorf("security.txt missing RFC 9116 required field %q", required)
		}
	}
}

func TestSecurityTxt_ExpiresInFuture(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/.well-known/security.txt", nil)
	w := httptest.NewRecorder()
	h.SecurityTxt(w, r)

	body := w.Body.String()
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, "Expires:") {
			ts := strings.TrimSpace(strings.TrimPrefix(line, "Expires:"))
			parsed, err := time.Parse(time.RFC3339, ts)
			if err != nil {
				t.Fatalf("Expires not RFC 3339: %q (%v)", ts, err)
			}
			if !parsed.After(time.Now()) {
				t.Errorf("Expires must be in the future, got %v", parsed)
			}
			return
		}
	}
	t.Fatal("Expires line not found")
}

func TestSecurityTxt_PlainTextContentType(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/.well-known/security.txt", nil)
	w := httptest.NewRecorder()
	h.SecurityTxt(w, r)
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/plain") {
		t.Errorf("Content-Type = %q, want text/plain (RFC 9116 §2.3)", ct)
	}
}
