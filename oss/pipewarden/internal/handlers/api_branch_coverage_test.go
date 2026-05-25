package handlers

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// TestListFindingsAllParams hits ListFindings with the various query-param
// branches (limit, severity, status, connection) to exercise the filter
// composition.
func TestListFindingsAllParams(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	for _, q := range []string{
		"",
		"?limit=5",
		"?severity=high",
		"?status=open",
		"?connection=demo",
		"?limit=abc", // invalid → ignored
		"?limit=5&severity=critical&status=open&connection=demo",
	} {
		req := httptest.NewRequest("GET", "/api/v1/analysis/findings"+q, nil)
		w := httptest.NewRecorder()
		h.ListFindings(w, req)
		if w.Code != 200 {
			t.Fatalf("q=%q: %d body=%s", q, w.Code, w.Body.String())
		}
	}
}

// TestListHistoryWithLimitParam.
func TestListHistoryWithParams(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	for _, q := range []string{"", "?limit=5", "?limit=abc", "?connection=demo"} {
		req := httptest.NewRequest("GET", "/api/v1/analysis/history"+q, nil)
		w := httptest.NewRecorder()
		h.ListHistory(w, req)
		if w.Code != 200 {
			t.Fatalf("q=%q: %d", q, w.Code)
		}
	}
}

// TestGetSummaryDateParams hits the date-filter branches of GetSummary.
func TestGetSummaryDateParams(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	for _, q := range []string{
		"",
		"?from=2026-01-01T00:00:00Z",
		"?to=2026-12-31T00:00:00Z",
		"?from=bad-date",
	} {
		req := httptest.NewRequest("GET", "/api/v1/analytics/summary"+q, nil)
		w := httptest.NewRecorder()
		h.GetSummary(w, req)
		if w.Code != 200 {
			t.Fatalf("q=%q: %d", q, w.Code)
		}
	}
}

// TestGetProvidersIsAlwaysSeven confirms the static provider listing.
func TestGetProvidersResponse(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/providers", nil)
	w := httptest.NewRecorder()
	h.GetProviders(w, req)
	if w.Code != 200 {
		t.Fatalf("status: %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "github") {
		t.Fatalf("response missing 'github': %s", w.Body.String())
	}
}

// TestAuthListPasskeysAuthed exercises the listing endpoint with a session.
func TestAuthListPasskeysAuthed(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	u, _ := db.CreateUser("pkk@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "K", "")
	req := makeAuthedRequest(t, "GET", "/api/v1/auth/passkeys", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthListPasskeys(w, req)
	if w.Code != 200 {
		t.Fatalf("list: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthListPasskeysUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthListPasskeys, "GET", "", nil)
	if w.Code != 401 {
		t.Fatalf("unauth: %d", w.Code)
	}
}

func TestAuthSettingsUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthSettings, "GET", "", nil)
	if w.Code != 401 {
		t.Fatalf("unauth: %d", w.Code)
	}
}

func TestAuthRecoveryStatusUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthRecoveryStatus, "GET", "", nil)
	if w.Code != 401 {
		t.Fatalf("unauth: %d", w.Code)
	}
}

func TestAuthRecoveryGenerateUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthRecoveryGenerate, "POST", "", nil)
	if w.Code != 401 {
		t.Fatalf("unauth: %d", w.Code)
	}
}

func TestAuthOnboardingUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthOnboarding, "POST", `{"name":"X"}`, nil)
	if w.Code != 401 {
		t.Fatalf("unauth: %d", w.Code)
	}
}

func TestAuthOnboardingWrongMethod(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	w, _ := doJSON(t, h.AuthOnboarding, "GET", "", nil)
	if w.Code != 405 {
		t.Fatalf("wrong method: %d", w.Code)
	}
}

func TestAuthOnboardingMissingName(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	u, _ := db.CreateUser("ob@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "O", "")
	req := makeAuthedRequest(t, "POST", "/api/v1/auth/onboarding", `{}`, u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthOnboarding(w, req)
	if w.Code != 422 {
		t.Fatalf("missing name: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthOnboardingBadJSON(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	u, _ := db.CreateUser("ob2@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "O", "")
	req := makeAuthedRequest(t, "POST", "/api/v1/auth/onboarding", `{garbage`, u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthOnboarding(w, req)
	if w.Code != 400 {
		t.Fatalf("bad json: %d", w.Code)
	}
}

func TestAuthOnboardingHappyPath(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	u, _ := db.CreateUser("ob3@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "O", "")
	req := makeAuthedRequest(t, "POST", "/api/v1/auth/onboarding",
		`{"name":"Real Name","company":"Acme"}`, u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthOnboarding(w, req)
	if w.Code != 200 {
		t.Fatalf("happy: %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "/dashboard") {
		t.Fatalf("expected next=/dashboard: %s", w.Body.String())
	}
}
