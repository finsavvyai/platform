package storage

import (
	"strings"
	"testing"
	"time"
)

func newDBT(t *testing.T) *DB {
	t.Helper()
	db, err := NewInMemory()
	if err != nil {
		t.Fatalf("NewInMemory: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func newUserT(t *testing.T, db *DB, email string) *UserRecord {
	t.Helper()
	u, err := db.CreateUser(email, "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "Name", "Co")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	return u
}

func TestAuthTokenIssueConsumeOnce(t *testing.T) {
	db := newDBT(t)
	u := newUserT(t, db, "tok@example.com")

	tok, err := db.CreateAuthToken(u.ID, TokenPurposeEmailVerify, time.Hour)
	if err != nil {
		t.Fatalf("CreateAuthToken: %v", err)
	}
	if len(tok) < 30 {
		t.Fatalf("token too short: %q", tok)
	}

	uid, err := db.ConsumeAuthToken(tok, TokenPurposeEmailVerify)
	if err != nil {
		t.Fatalf("Consume: %v", err)
	}
	if uid != u.ID {
		t.Fatalf("uid=%d want %d", uid, u.ID)
	}

	// Second consume -> invalid (already used)
	if _, err := db.ConsumeAuthToken(tok, TokenPurposeEmailVerify); err != ErrTokenInvalid {
		t.Fatalf("second consume err=%v want ErrTokenInvalid", err)
	}

	// Wrong purpose -> invalid
	tok2, _ := db.CreateAuthToken(u.ID, TokenPurposeEmailVerify, time.Hour)
	if _, err := db.ConsumeAuthToken(tok2, TokenPurposePasswordReset); err != ErrTokenInvalid {
		t.Fatalf("wrong purpose: %v", err)
	}
}

func TestAuthTokenExpired(t *testing.T) {
	db := newDBT(t)
	u := newUserT(t, db, "exp@example.com")
	tok, err := db.CreateAuthToken(u.ID, TokenPurposeEmailVerify, -time.Second)
	if err != nil {
		t.Fatalf("CreateAuthToken: %v", err)
	}
	if _, err := db.ConsumeAuthToken(tok, TokenPurposeEmailVerify); err != ErrTokenInvalid {
		t.Fatalf("expired must be invalid: %v", err)
	}
}

func TestAuthTokenMissing(t *testing.T) {
	db := newDBT(t)
	if _, err := db.ConsumeAuthToken("nonsense-token", TokenPurposeEmailVerify); err != ErrTokenInvalid {
		t.Fatalf("missing must be invalid: %v", err)
	}
}

func TestMarkEmailVerifiedAndPasswordRotation(t *testing.T) {
	db := newDBT(t)
	u := newUserT(t, db, "ver@example.com")

	if err := db.MarkEmailVerified(u.ID); err != nil {
		t.Fatalf("MarkEmailVerified: %v", err)
	}
	got, _ := db.GetUserByID(u.ID)
	if !got.EmailVerified {
		t.Fatalf("email_verified not flipped")
	}

	prevVer := got.PasswordVersion
	if err := db.UpdatePasswordHash(u.ID, "$2a$10$NEWHASHnewhashnewhashnewhashnewhashnewhashnewhashAAA"); err != nil {
		t.Fatalf("UpdatePasswordHash: %v", err)
	}
	got2, _ := db.GetUserByID(u.ID)
	if got2.PasswordVersion <= prevVer {
		t.Fatalf("password_version did not increment: %d -> %d", prevVer, got2.PasswordVersion)
	}
}

func TestPasskeyLifecycle(t *testing.T) {
	db := newDBT(t)
	u := newUserT(t, db, "pk@example.com")

	rec := PasskeyRecord{
		UserID:       u.ID,
		CredentialID: []byte("cred-abc"),
		PublicKey:    []byte("pk-bytes"),
		SignCount:    0,
		Transports:   "usb,internal",
		Name:         "MacBook",
	}
	saved, err := db.CreatePasskey(rec)
	if err != nil {
		t.Fatalf("CreatePasskey: %v", err)
	}
	if saved.ID == 0 || saved.Name != "MacBook" {
		t.Fatalf("saved=%+v", saved)
	}

	creds, err := db.ListPasskeysForUser(u.ID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(creds) != 1 {
		t.Fatalf("len=%d, want 1", len(creds))
	}

	by, err := db.GetPasskeyByCredentialID([]byte("cred-abc"))
	if err != nil || by.ID != saved.ID {
		t.Fatalf("Get by cred: %v %+v", err, by)
	}
	if _, err := db.GetPasskeyByCredentialID([]byte("nope")); err != ErrUserNotFound {
		t.Fatalf("missing must be ErrUserNotFound: %v", err)
	}

	if err := db.UpdatePasskeySignCount(saved.ID, 5); err != nil {
		t.Fatalf("UpdateSign: %v", err)
	}
	by2, _ := db.GetPasskeyByCredentialID([]byte("cred-abc"))
	if by2.SignCount != 5 {
		t.Fatalf("count=%d, want 5", by2.SignCount)
	}

	// Cross-user delete should fail
	other := newUserT(t, db, "other@example.com")
	if err := db.DeletePasskey(other.ID, saved.ID); err != ErrUserNotFound {
		t.Fatalf("cross-user delete must fail: %v", err)
	}
	if err := db.DeletePasskey(u.ID, saved.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	creds2, _ := db.ListPasskeysForUser(u.ID)
	if len(creds2) != 0 {
		t.Fatalf("expected 0 creds after delete: %d", len(creds2))
	}
}

func TestChallengeSaveLoadOnce(t *testing.T) {
	db := newDBT(t)
	u := newUserT(t, db, "chal@example.com")

	if err := db.SaveChallenge("sess-1", u.ID, `{"k":"v"}`, "register"); err != nil {
		t.Fatalf("Save: %v", err)
	}
	uid, data, purpose, err := db.LoadChallenge("sess-1")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if uid != u.ID || purpose != "register" || !strings.Contains(data, `"k":"v"`) {
		t.Fatalf("Load: uid=%d purpose=%q data=%q", uid, purpose, data)
	}

	// Second load -> not found (deleted by Load)
	if _, _, _, err := db.LoadChallenge("sess-1"); err == nil {
		t.Fatalf("expected error on second load")
	}
}

func TestGitHubUserProvisioning(t *testing.T) {
	db := newDBT(t)

	// Missing -> ErrUserNotFound
	if _, err := db.GetUserByGitHubID(99999); err != ErrUserNotFound {
		t.Fatalf("missing gh user: %v", err)
	}

	u, err := db.CreateUserFromGitHub(12345, "ghuser@example.com", "GH User")
	if err != nil {
		t.Fatalf("CreateUserFromGitHub: %v", err)
	}
	if u.Email != "ghuser@example.com" {
		t.Fatalf("email=%q", u.Email)
	}

	got, err := db.GetUserByGitHubID(12345)
	if err != nil || got.ID != u.ID {
		t.Fatalf("Get gh: %v %+v", err, got)
	}

	// Duplicate email/github_id -> ErrUserExists
	if _, err := db.CreateUserFromGitHub(12345, "ghuser@example.com", "Dup"); err != ErrUserExists {
		t.Fatalf("duplicate must be ErrUserExists: %v", err)
	}
}

func TestTOTPSecretLifecycle(t *testing.T) {
	db := newDBT(t)
	u := newUserT(t, db, "totp@example.com")

	// Set provisional
	if err := db.SetTOTPSecret(u.ID, "JBSWY3DPEHPK3PXP", false); err != nil {
		t.Fatalf("SetTOTPSecret: %v", err)
	}
	secret, enabled, err := db.GetTOTPState(u.ID)
	if err != nil {
		t.Fatalf("GetTOTPState: %v", err)
	}
	if secret != "JBSWY3DPEHPK3PXP" || enabled {
		t.Fatalf("provisional: secret=%q enabled=%v", secret, enabled)
	}

	// Confirm -> enabled=true
	if err := db.SetTOTPSecret(u.ID, "JBSWY3DPEHPK3PXP", true); err != nil {
		t.Fatalf("SetTOTPSecret(true): %v", err)
	}
	_, enabled, _ = db.GetTOTPState(u.ID)
	if !enabled {
		t.Fatalf("not enabled after confirm")
	}

	// User w/o TOTP returns empty secret + disabled
	other := newUserT(t, db, "no-totp@example.com")
	s, e, err := db.GetTOTPState(other.ID)
	if err != nil {
		t.Fatalf("no totp user: %v", err)
	}
	if s != "" || e {
		t.Fatalf("no-totp must be empty/false, got %q %v", s, e)
	}
}

func TestUserMarkOnboardedAndGetByEmail(t *testing.T) {
	db := newDBT(t)
	u := newUserT(t, db, "ob@example.com")

	if err := db.MarkOnboarded(u.ID, "Olivia", "Acme Inc"); err != nil {
		t.Fatalf("MarkOnboarded: %v", err)
	}
	got, _ := db.GetUserByID(u.ID)
	if !got.Onboarded || got.Name != "Olivia" || got.Company != "Acme Inc" {
		t.Fatalf("post-onboard: %+v", got)
	}

	by, err := db.GetUserByEmail("ob@example.com")
	if err != nil || by.ID != u.ID {
		t.Fatalf("GetUserByEmail: %v %+v", err, by)
	}

	if _, err := db.GetUserByEmail("nobody@example.com"); err != ErrUserNotFound {
		t.Fatalf("missing email: %v", err)
	}
}

func TestWaitlistSignupAndCount(t *testing.T) {
	db := newDBT(t)

	if _, err := db.CreateWaitlistSignup(WaitlistSignup{Email: "a@example.com", Source: "form"}); err != nil {
		t.Fatalf("Create a: %v", err)
	}
	if _, err := db.CreateWaitlistSignup(WaitlistSignup{Email: "b@example.com", Tier: "pro", Source: "form"}); err != nil {
		t.Fatalf("Create b: %v", err)
	}
	// Email required
	if _, err := db.CreateWaitlistSignup(WaitlistSignup{}); err == nil {
		t.Fatalf("expected error for missing email")
	}

	n, err := db.CountWaitlistSignups()
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if n < 2 {
		t.Fatalf("expected >=2 signups, got %d", n)
	}
}
