package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/pquerna/otp/totp"
)

// makeAuthedRequest builds a request with a valid session cookie for `userID`.
// withSessionSecret must be active when this is called. passwordVersion must
// match the stored user (or 0 for forged sessions).
func makeAuthedRequest(t *testing.T, method, target, body string, userID int64, email string, passwordVersion ...int64) *http.Request {
	t.Helper()
	var pwv int64
	if len(passwordVersion) > 0 {
		pwv = passwordVersion[0]
	}
	tok, err := auth.IssueSession(userID, email, true, pwv)
	if err != nil {
		t.Fatalf("IssueSession: %v", err)
	}
	var rd *strings.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	var req *http.Request
	if rd != nil {
		req = httptest.NewRequest(method, target, rd)
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, target, nil)
	}
	req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: tok})
	return req
}

// ----- AuthMe coverage lift ---------------------------------------------------

func TestAuthMeUnauthenticated(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)

	w, _ := doJSON(t, h.AuthMe, "GET", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("no cookie: %d", w.Code)
	}
}

func TestAuthMeAuthedExistingUser(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)

	u, err := db.CreateUser("me@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "Me", "")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	req := makeAuthedRequest(t, "GET", "/api/v1/auth/me", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthMe(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("authed: %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "me@pipewarden.io") {
		t.Fatalf("body missing email: %s", w.Body.String())
	}
}

func TestAuthMeDeletedUserClearsCookie(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)

	// Forge a session for a user that doesn't exist in the DB.
	req := makeAuthedRequest(t, "GET", "/api/v1/auth/me", "", 99999, "ghost@x.com")
	w := httptest.NewRecorder()
	h.AuthMe(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("deleted user: %d body=%s", w.Code, w.Body.String())
	}
	// Should clear the cookie via Set-Cookie with empty value or past expiry.
	if cookies := w.Result().Cookies(); len(cookies) == 0 {
		t.Fatalf("expected Set-Cookie to clear session, got none")
	}
}

// ----- AuthVerifyConfirm coverage lift ----------------------------------------

func TestAuthVerifyConfirmMissingToken(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/auth/verify/confirm", nil)
	w := httptest.NewRecorder()
	h.AuthVerifyConfirm(w, req)
	if w.Code != http.StatusSeeOther {
		t.Fatalf("missing token: %d", w.Code)
	}
	if loc := w.Header().Get("Location"); !strings.Contains(loc, "reason=missing") {
		t.Fatalf("Location=%q", loc)
	}
}

func TestAuthVerifyConfirmExpiredToken(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/auth/verify/confirm?token=nope", nil)
	w := httptest.NewRecorder()
	h.AuthVerifyConfirm(w, req)
	if w.Code != http.StatusSeeOther {
		t.Fatalf("bad token: %d", w.Code)
	}
	if loc := w.Header().Get("Location"); !strings.Contains(loc, "reason=expired") {
		t.Fatalf("Location=%q", loc)
	}
}

func TestAuthVerifyConfirmHappyPath(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("verify@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "V", "")
	tok, err := db.CreateAuthToken(u.ID, storage.TokenPurposeEmailVerify, time.Hour)
	if err != nil {
		t.Fatalf("CreateAuthToken: %v", err)
	}
	req := httptest.NewRequest("GET", "/api/v1/auth/verify/confirm?token="+tok, nil)
	w := httptest.NewRecorder()
	h.AuthVerifyConfirm(w, req)
	if w.Code != http.StatusSeeOther {
		t.Fatalf("success: %d", w.Code)
	}
	if loc := w.Header().Get("Location"); !strings.Contains(loc, "verified=1") {
		t.Fatalf("Location=%q", loc)
	}
}

// ----- totpCheck direct unit tests --------------------------------------------

func TestTOTPCheckDisabled(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("totp@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "T", "")
	w := httptest.NewRecorder()
	if !h.totpCheck(u.ID, "", w) {
		t.Fatalf("disabled TOTP should allow login")
	}
}

func TestTOTPCheckMissingCodeReturns401(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("totp@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "T", "")
	key, _ := totp.Generate(totp.GenerateOpts{Issuer: "PipeWarden", AccountName: u.Email})
	_ = db.SetTOTPSecret(u.ID, key.Secret(), true)

	w := httptest.NewRecorder()
	if h.totpCheck(u.ID, "", w) {
		t.Fatalf("missing code should not allow login")
	}
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "code_required") {
		t.Fatalf("body missing code_required flag: %s", w.Body.String())
	}
}

func TestTOTPCheckInvalidCodeReturns401(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("totp@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "T", "")
	key, _ := totp.Generate(totp.GenerateOpts{Issuer: "PipeWarden", AccountName: u.Email})
	_ = db.SetTOTPSecret(u.ID, key.Secret(), true)

	w := httptest.NewRecorder()
	if h.totpCheck(u.ID, "000000", w) {
		t.Fatalf("invalid code should not allow login")
	}
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestTOTPCheckValidCodeAllows(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("totp@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "T", "")
	key, _ := totp.Generate(totp.GenerateOpts{Issuer: "PipeWarden", AccountName: u.Email})
	_ = db.SetTOTPSecret(u.ID, key.Secret(), true)

	code, err := totp.GenerateCode(key.Secret(), time.Now())
	if err != nil {
		t.Fatalf("GenerateCode: %v", err)
	}
	w := httptest.NewRecorder()
	if !h.totpCheck(u.ID, code, w) {
		t.Fatalf("valid code should allow login")
	}
}

func TestTOTPCheckRecoveryCodeAllows(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("totp@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "T", "")
	key, _ := totp.Generate(totp.GenerateOpts{Issuer: "PipeWarden", AccountName: u.Email})
	_ = db.SetTOTPSecret(u.ID, key.Secret(), true)
	codes, err := db.GenerateRecoveryCodes(u.ID)
	if err != nil || len(codes) == 0 {
		t.Fatalf("GenerateRecoveryCodes: %v", err)
	}
	w := httptest.NewRecorder()
	if !h.totpCheck(u.ID, codes[0], w) {
		t.Fatalf("recovery code should allow login, body=%s", w.Body.String())
	}
}

// ----- fetchMetadata direct unit tests ----------------------------------------

func TestFetchMetadataNonHTTPS(t *testing.T) {
	if _, err := fetchMetadata("http://example.com/meta.xml"); err == nil {
		t.Fatalf("expected error for http:// URL")
	}
}

func TestFetchMetadataServerError(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()
	// Even TLS server URL won't match https:// prefix check from a custom CA;
	// the helper rejects on prefix so this validates the prefix branch.
	_, err := fetchMetadata(strings.Replace(srv.URL, "https://", "http://", 1))
	if err == nil {
		t.Fatalf("expected prefix rejection")
	}
}

// ----- AuthPasskeyLoginBegin extra branches -----------------------------------

func TestAuthPasskeyLoginBeginUnknownEmail(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ORIGIN", "http://localhost:8080")
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ID", "localhost")

	body := `{"email":"nobody@pipewarden.io"}`
	w, _ := doJSON(t, h.AuthPasskeyLoginBegin, "POST", body, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("unknown email: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthPasskeyLoginBeginNoPasskey(t *testing.T) {
	h, db := newTestHandlersDB(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ORIGIN", "http://localhost:8080")
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ID", "localhost")
	_, err := db.CreateUser("nopasskey@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "N", "")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	body := `{"email":"nopasskey@pipewarden.io"}`
	w, _ := doJSON(t, h.AuthPasskeyLoginBegin, "POST", body, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("no passkey: %d body=%s", w.Code, w.Body.String())
	}
}

// ----- AuthPasskeyLoginFinish extra branches ----------------------------------

func TestAuthPasskeyLoginFinishMissingCookie(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ORIGIN", "http://localhost:8080")
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ID", "localhost")
	w, _ := doJSON(t, h.AuthPasskeyLoginFinish, "POST", `{}`, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("missing cookie: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthPasskeyLoginFinishWrongMethod(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	w, _ := doJSON(t, h.AuthPasskeyLoginFinish, "GET", "", nil)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("wrong method: %d", w.Code)
	}
}

// ----- AuthPasskeyRegisterBegin/Finish unauth + bad-cookie branches ----------

func TestAuthPasskeyRegisterBeginUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthPasskeyRegisterBegin, "POST", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauth begin: %d", w.Code)
	}
}

func TestAuthPasskeyRegisterFinishUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthPasskeyRegisterFinish, "POST", "{}", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauth finish: %d", w.Code)
	}
}

func TestAuthPasskeyRegisterFinishNoCookie(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ORIGIN", "http://localhost:8080")
	t.Setenv("PIPEWARDEN_WEBAUTHN_RP_ID", "localhost")
	u, _ := db.CreateUser("rk@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "R", "")
	req := makeAuthedRequest(t, "POST", "/api/v1/auth/passkey/register/finish", "{}", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthPasskeyRegisterFinish(w, req)
	// No challenge cookie present → 400 from popChallenge.
	if w.Code != http.StatusBadRequest {
		t.Fatalf("no challenge cookie: %d body=%s", w.Code, w.Body.String())
	}
}

// ----- discoverableLookup direct unit test -----------------------------------

func TestDiscoverableLookupHappyAndMissing(t *testing.T) {
	h, db := newTestHandlersDB(t)
	u, _ := db.CreateUser("disc@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "D", "")
	_, err := db.CreatePasskey(storage.PasskeyRecord{
		UserID:       u.ID,
		CredentialID: []byte("cred-disc"),
		PublicKey:    []byte("pk-disc"),
		SignCount:    1,
		Transports:   "internal",
		Name:         "test-key",
	})
	if err != nil {
		t.Fatalf("CreatePasskey: %v", err)
	}

	wu, err := h.discoverableLookup([]byte("cred-disc"), nil)
	if err != nil {
		t.Fatalf("lookup happy: %v", err)
	}
	if wu == nil {
		t.Fatalf("lookup returned nil user")
	}

	if _, err := h.discoverableLookup([]byte("nope"), nil); err == nil {
		t.Fatalf("lookup unknown should error")
	}
}

// ----- AuthTOTPVerify + AuthTOTPDisable extra branches -----------------------

func TestAuthTOTPVerifyUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthTOTPVerify, "POST", `{"code":"123456"}`, nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauth verify: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthTOTPVerifyWrongMethod(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	w, _ := doJSON(t, h.AuthTOTPVerify, "GET", "", nil)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("wrong method: %d", w.Code)
	}
}

func TestAuthTOTPDisableUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthTOTPDisable, "POST", `{}`, nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauth disable: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthTOTPSetupAuthed(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	u, _ := db.CreateUser("setup@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "S", "")
	req := makeAuthedRequest(t, "POST", "/api/v1/auth/totp/setup", "", u.ID, u.Email, u.PasswordVersion)
	w := httptest.NewRecorder()
	h.AuthTOTPSetup(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("setup authed: %d body=%s", w.Code, w.Body.String())
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["secret"] == nil || resp["otpauth"] == nil {
		t.Fatalf("missing fields: %s", w.Body.String())
	}
}

// ----- AuthPasswordResetFinish short-password branch -------------------------

func TestAuthPasswordResetFinishShortPassword(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)
	u, _ := db.CreateUser("rst@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "Rst", "")
	tok, _ := db.CreateAuthToken(u.ID, storage.TokenPurposePasswordReset, time.Hour)
	body, _ := json.Marshal(map[string]string{"token": tok, "password": "short"})
	w, _ := doJSON(t, h.AuthPasswordResetFinish, "POST", string(body), nil)
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("short password: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthPasswordResetFinishBadToken(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	body := `{"token":"bogus","password":"longenoughpassword"}`
	w, _ := doJSON(t, h.AuthPasswordResetFinish, "POST", body, nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("bad token: %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthPasswordResetFinishWrongMethod(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	w, _ := doJSON(t, h.AuthPasswordResetFinish, "GET", "", nil)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("wrong method: %d", w.Code)
	}
}

// ----- AuthVerifyRequest extra branches --------------------------------------

func TestAuthVerifyRequestUnauthed(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	withSessionSecret(t)
	w, _ := doJSON(t, h.AuthVerifyRequest, "POST", "", nil)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauth: %d", w.Code)
	}
}

func TestAuthVerifyRequestWrongMethod(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	w, _ := doJSON(t, h.AuthVerifyRequest, "GET", "", nil)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("wrong method: %d", w.Code)
	}
}
