package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/pquerna/otp/totp"
)

// withSessionSecret stamps PIPEWARDEN_SESSION_SECRET for the duration of
// the test so JWT signing/verification works.
func withSessionSecret(t *testing.T) {
	t.Helper()
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "dev-32byte-session-secret-pad-aaa-1")
}

func doJSON(t *testing.T, h http.HandlerFunc, method, body string, cookies []*http.Cookie) (*httptest.ResponseRecorder, []*http.Cookie) {
	t.Helper()
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, "/", rd)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w := httptest.NewRecorder()
	h(w, req)
	return w, w.Result().Cookies()
}

func sessionFor(t *testing.T, h *Handlers, email, password string) []*http.Cookie {
	t.Helper()
	withSessionSecret(t)
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	w, cookies := doJSON(t, h.AuthSignup, "POST", string(body), nil)
	if w.Code != 200 {
		t.Fatalf("signup: status=%d body=%s", w.Code, w.Body.String())
	}
	return cookies
}

func TestAuthSignupValidatesInputs(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)

	cases := []struct {
		name string
		body string
		want int
	}{
		{"wrong method", "", http.StatusMethodNotAllowed},
		{"bad json", `not-json`, http.StatusBadRequest},
		{"missing email", `{"password":"validpass1234"}`, http.StatusUnprocessableEntity},
		{"bad email", `{"email":"no-at-sign","password":"validpass1234"}`, http.StatusUnprocessableEntity},
		{"short password", `{"email":"x@y.com","password":"123"}`, http.StatusUnprocessableEntity},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			method := "POST"
			if tc.name == "wrong method" {
				method = "GET"
			}
			w, _ := doJSON(t, h.AuthSignup, method, tc.body, nil)
			if w.Code != tc.want {
				t.Fatalf("status=%d want %d body=%s", w.Code, tc.want, w.Body.String())
			}
		})
	}
}

func TestAuthSignupAndDuplicate(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	cookies := sessionFor(t, h, "alice@pipewarden.io", "alicepass1234")
	if len(cookies) == 0 {
		t.Fatal("signup did not set cookie")
	}

	// Re-signup with same email -> 409
	w, _ := doJSON(t, h.AuthSignup, "POST", `{"email":"alice@pipewarden.io","password":"otherpass1234"}`, nil)
	if w.Code != http.StatusConflict {
		t.Fatalf("status=%d want 409", w.Code)
	}
}

func TestAuthLoginAndLogoutFlow(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	_ = sessionFor(t, h, "bob@pipewarden.io", "bobspass1234")

	// Bad password
	w, _ := doJSON(t, h.AuthLogin, "POST", `{"email":"bob@pipewarden.io","password":"wrong"}`, nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("bad password: status=%d", w.Code)
	}
	// Unknown email
	w, _ = doJSON(t, h.AuthLogin, "POST", `{"email":"nobody@x.com","password":"x"}`, nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unknown email: status=%d", w.Code)
	}
	// Bad json
	w, _ = doJSON(t, h.AuthLogin, "POST", `bad`, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bad json: status=%d", w.Code)
	}
	// Wrong method
	w, _ = doJSON(t, h.AuthLogin, "GET", "", nil)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("wrong method: status=%d", w.Code)
	}

	// Successful login
	w, ck := doJSON(t, h.AuthLogin, "POST", `{"email":"bob@pipewarden.io","password":"bobspass1234"}`, nil)
	if w.Code != 200 {
		t.Fatalf("login: status=%d", w.Code)
	}
	if len(ck) == 0 {
		t.Fatal("login did not set cookie")
	}

	// Logout clears the cookie
	w, ck2 := doJSON(t, h.AuthLogout, "POST", "", ck)
	if w.Code != 200 {
		t.Fatalf("logout: status=%d", w.Code)
	}
	hadClearedCookie := false
	for _, c := range ck2 {
		if c.Name == auth.SessionCookie && (c.MaxAge < 0 || c.Value == "") {
			hadClearedCookie = true
		}
	}
	if !hadClearedCookie {
		t.Fatal("logout did not emit a clear-cookie")
	}
}

func TestAuthMeRequiresSession(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)

	// No cookie -> 401
	w, _ := doJSON(t, h.AuthMe, "GET", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("no cookie: status=%d", w.Code)
	}

	cookies := sessionFor(t, h, "carol@pipewarden.io", "carolpass1234")
	w, _ = doJSON(t, h.AuthMe, "GET", "", cookies)
	if w.Code != 200 {
		t.Fatalf("with cookie: status=%d body=%s", w.Code, w.Body.String())
	}
	var resp struct {
		User struct{ Email string } `json:"user"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.User.Email != "carol@pipewarden.io" {
		t.Fatalf("wrong user email: %q", resp.User.Email)
	}
}

func TestAuthOnboardingPath(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	// No session
	w, _ := doJSON(t, h.AuthOnboarding, "POST", `{"name":"x"}`, nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("no session: %d", w.Code)
	}

	cookies := sessionFor(t, h, "dan@pipewarden.io", "danspass1234")

	// Bad method
	w, _ = doJSON(t, h.AuthOnboarding, "GET", "", cookies)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("method: %d", w.Code)
	}
	// Bad json
	w, _ = doJSON(t, h.AuthOnboarding, "POST", `{`, cookies)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bad json: %d", w.Code)
	}
	// Missing name
	w, _ = doJSON(t, h.AuthOnboarding, "POST", `{}`, cookies)
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("missing name: %d", w.Code)
	}
	// Happy path
	w, _ = doJSON(t, h.AuthOnboarding, "POST", `{"name":"Dan","company":"Test Inc"}`, cookies)
	if w.Code != 200 {
		t.Fatalf("onboard: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthSettingsAndListPasskeys(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	// No session
	w, _ := doJSON(t, h.AuthSettings, "GET", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("settings no session: %d", w.Code)
	}
	w, _ = doJSON(t, h.AuthListPasskeys, "GET", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("listpk no session: %d", w.Code)
	}

	cookies := sessionFor(t, h, "eve@pipewarden.io", "evespass1234")

	w, _ = doJSON(t, h.AuthSettings, "GET", "", cookies)
	if w.Code != 200 {
		t.Fatalf("settings: %d", w.Code)
	}
	w, _ = doJSON(t, h.AuthListPasskeys, "GET", "", cookies)
	if w.Code != 200 {
		t.Fatalf("listpk: %d", w.Code)
	}
}

func TestAuthDeletePasskeyValidation(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	cookies := sessionFor(t, h, "fred@pipewarden.io", "fredpass12345")

	// Wrong method
	req := httptest.NewRequest("GET", "/api/v1/auth/passkeys/1", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w := httptest.NewRecorder()
	h.AuthDeletePasskey(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("method: %d", w.Code)
	}

	// Bad id
	req = httptest.NewRequest("DELETE", "/api/v1/auth/passkeys/notnum", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w = httptest.NewRecorder()
	h.AuthDeletePasskey(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bad id: %d", w.Code)
	}

	// No session
	req = httptest.NewRequest("DELETE", "/api/v1/auth/passkeys/1", nil)
	w = httptest.NewRecorder()
	h.AuthDeletePasskey(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("no session: %d", w.Code)
	}
}

func TestAuthRecoveryGenerateAndStatus(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	// No session
	w, _ := doJSON(t, h.AuthRecoveryGenerate, "POST", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("gen no session: %d", w.Code)
	}
	w, _ = doJSON(t, h.AuthRecoveryStatus, "GET", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status no session: %d", w.Code)
	}

	cookies := sessionFor(t, h, "gina@pipewarden.io", "ginapass1234")

	// Wrong method on generate
	w, _ = doJSON(t, h.AuthRecoveryGenerate, "GET", "", cookies)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("gen method: %d", w.Code)
	}

	// Generate -> codes
	w, _ = doJSON(t, h.AuthRecoveryGenerate, "POST", "", cookies)
	if w.Code != 200 {
		t.Fatalf("generate: %d body=%s", w.Code, w.Body.String())
	}
	var gen struct{ Codes []string }
	_ = json.Unmarshal(w.Body.Bytes(), &gen)
	if len(gen.Codes) == 0 {
		t.Fatalf("no codes returned: %s", w.Body.String())
	}

	// Status reports >0
	w, _ = doJSON(t, h.AuthRecoveryStatus, "GET", "", cookies)
	if w.Code != 200 {
		t.Fatalf("status: %d", w.Code)
	}
	var st struct {
		UnusedCodes int `json:"unused_codes"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &st)
	if st.UnusedCodes == 0 {
		t.Fatalf("expected >0 codes, got %+v body=%s", st, w.Body.String())
	}
}

func TestAuthTOTPEnrollVerifyDisable(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	cookies := sessionFor(t, h, "henry@pipewarden.io", "henrypass1234")

	// Wrong method
	w, _ := doJSON(t, h.AuthTOTPSetup, "GET", "", cookies)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("setup method: %d", w.Code)
	}
	// No session
	w, _ = doJSON(t, h.AuthTOTPSetup, "POST", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("setup no sess: %d", w.Code)
	}

	// Setup -> {secret, otpauth}
	w, _ = doJSON(t, h.AuthTOTPSetup, "POST", "", cookies)
	if w.Code != 200 {
		t.Fatalf("setup: %d body=%s", w.Code, w.Body.String())
	}
	var setup struct{ Secret, Otpauth string }
	_ = json.Unmarshal(w.Body.Bytes(), &setup)
	if setup.Secret == "" {
		t.Fatalf("no secret returned: %s", w.Body.String())
	}

	// Verify with bogus code
	w, _ = doJSON(t, h.AuthTOTPVerify, "POST", `{"code":"000000"}`, cookies)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("verify bogus: %d", w.Code)
	}

	// Verify with real code
	code, err := totp.GenerateCode(setup.Secret, time.Now())
	if err != nil {
		t.Fatalf("totp generate: %v", err)
	}
	body := bytes.NewBufferString(`{"code":"` + code + `"}`)
	req := httptest.NewRequest("POST", "/", body)
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w = httptest.NewRecorder()
	h.AuthTOTPVerify(w, req)
	if w.Code != 200 {
		t.Fatalf("verify real: %d body=%s", w.Code, w.Body.String())
	}

	// Disable with wrong code -> 401
	w, _ = doJSON(t, h.AuthTOTPDisable, "POST", `{"code":"000000"}`, cookies)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("disable wrong code: %d", w.Code)
	}

	// Disable with real code
	code2, _ := totp.GenerateCode(setup.Secret, time.Now())
	body2 := bytes.NewBufferString(`{"code":"` + code2 + `"}`)
	req = httptest.NewRequest("POST", "/", body2)
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w = httptest.NewRecorder()
	h.AuthTOTPDisable(w, req)
	if w.Code != 200 {
		t.Fatalf("disable real: %d body=%s", w.Code, w.Body.String())
	}

	// Disable again -> 400 (not enabled)
	w, _ = doJSON(t, h.AuthTOTPDisable, "POST", `{"code":"000000"}`, cookies)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("disable twice: %d", w.Code)
	}
}

func TestAuthVerifyAndPasswordReset(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	cookies := sessionFor(t, h, "ivy@pipewarden.io", "ivyspass12345")

	// Verify request: email is log-only because no SMTP host
	w, _ := doJSON(t, h.AuthVerifyRequest, "POST", "", cookies)
	if w.Code != 200 {
		t.Fatalf("verify req: %d body=%s", w.Code, w.Body.String())
	}

	// Confirm with empty token -> redirect to /verify-error
	req := httptest.NewRequest("GET", "/api/v1/auth/verify/confirm", nil)
	w = httptest.NewRecorder()
	h.AuthVerifyConfirm(w, req)
	if w.Code != http.StatusSeeOther {
		t.Fatalf("confirm empty: %d", w.Code)
	}
	if !strings.Contains(w.Header().Get("Location"), "/verify-error") {
		t.Fatalf("expected verify-error redirect, got %q", w.Header().Get("Location"))
	}

	// Confirm with bogus token -> redirect to /verify-error
	req = httptest.NewRequest("GET", "/api/v1/auth/verify/confirm?token=does-not-exist", nil)
	w = httptest.NewRecorder()
	h.AuthVerifyConfirm(w, req)
	if w.Code != http.StatusSeeOther {
		t.Fatalf("confirm bogus: %d", w.Code)
	}

	// Password reset begin: always 200, even for unknown emails
	w, _ = doJSON(t, h.AuthPasswordResetBegin, "POST", `{"email":"nobody@x.com"}`, nil)
	if w.Code != 200 {
		t.Fatalf("reset begin unknown: %d", w.Code)
	}
	w, _ = doJSON(t, h.AuthPasswordResetBegin, "POST", `{"email":"ivy@pipewarden.io"}`, nil)
	if w.Code != 200 {
		t.Fatalf("reset begin real: %d", w.Code)
	}

	// Reset finish with bogus token -> 401
	w, _ = doJSON(t, h.AuthPasswordResetFinish, "POST", `{"token":"nope","password":"newvalidpass1"}`, nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("reset finish bogus: %d", w.Code)
	}

	// Method/JSON guards
	w, _ = doJSON(t, h.AuthVerifyRequest, "GET", "", cookies)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("verify method: %d", w.Code)
	}
	w, _ = doJSON(t, h.AuthPasswordResetBegin, "POST", `bad`, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("reset begin bad json: %d", w.Code)
	}
	w, _ = doJSON(t, h.AuthPasswordResetFinish, "POST", `bad`, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("reset finish bad json: %d", w.Code)
	}
}
