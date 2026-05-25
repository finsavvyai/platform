package sso

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

type memMFAStore struct {
	stamps map[uuid.UUID]time.Time
}

func (m *memMFAStore) LastMFA(_ context.Context, id uuid.UUID) (time.Time, error) {
	return m.stamps[id], nil
}
func (m *memMFAStore) StampMFA(_ context.Context, id uuid.UUID) error {
	if m.stamps == nil {
		m.stamps = make(map[uuid.UUID]time.Time)
	}
	m.stamps[id] = time.Now()
	return nil
}

func TestEnsureFreshMFA_RequiresWhenNeverMFAd(t *testing.T) {
	err := EnsureFreshMFA(context.Background(), &memMFAStore{}, uuid.New(), nil)
	if !errors.Is(err, ErrMFARequired) {
		t.Fatalf("never-MFA'd user must get ErrMFARequired, got %v", err)
	}
}

func TestEnsureFreshMFA_AllowsWithinWindow(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	store := &memMFAStore{stamps: map[uuid.UUID]time.Time{uid: now.Add(-2 * time.Minute)}}
	err := EnsureFreshMFA(context.Background(), store, uid, func() time.Time { return now })
	if err != nil {
		t.Fatalf("2-minute-old MFA must allow, got %v", err)
	}
}

func TestEnsureFreshMFA_RejectsExpired(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	store := &memMFAStore{stamps: map[uuid.UUID]time.Time{uid: now.Add(-10 * time.Minute)}}
	err := EnsureFreshMFA(context.Background(), store, uid, func() time.Time { return now })
	if !errors.Is(err, ErrMFARequired) {
		t.Fatalf("10-minute-old MFA must require step-up, got %v", err)
	}
}

func TestTOTP_GenerateAndVerifyRoundTrip(t *testing.T) {
	secret, err := GenerateTOTPSecret()
	if err != nil {
		t.Fatalf("GenerateTOTPSecret: %v", err)
	}
	now := time.Unix(1_700_000_000, 0)
	code, err := TOTPCode(secret, now)
	if err != nil {
		t.Fatalf("TOTPCode: %v", err)
	}
	if len(code) != 6 {
		t.Fatalf("expected 6-digit code, got %q", code)
	}
	ok, err := VerifyTOTP(secret, code, now)
	if err != nil || !ok {
		t.Fatalf("freshly generated code must verify, ok=%v err=%v", ok, err)
	}
}

func TestTOTP_VerifyToleratesOneStepDrift(t *testing.T) {
	secret, _ := GenerateTOTPSecret()
	t0 := time.Unix(1_700_000_000, 0)
	code, _ := TOTPCode(secret, t0)

	if ok, _ := VerifyTOTP(secret, code, t0.Add(30*time.Second)); !ok {
		t.Fatal("code must verify within +1 step")
	}
	if ok, _ := VerifyTOTP(secret, code, t0.Add(-30*time.Second)); !ok {
		t.Fatal("code must verify within -1 step")
	}
	if ok, _ := VerifyTOTP(secret, code, t0.Add(120*time.Second)); ok {
		t.Fatal("code must NOT verify outside ±1 step")
	}
}

func TestTOTP_RFC6238_KnownVector(t *testing.T) {
	// RFC 6238 Appendix B: secret "12345678901234567890" (ASCII), at
	// unix time 59, SHA-1 / 6-digit / 30s, yields code 287082.
	secret := "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	got, err := TOTPCode(secret, time.Unix(59, 0))
	if err != nil {
		t.Fatalf("TOTPCode: %v", err)
	}
	if got != "287082" {
		t.Fatalf("RFC6238 vector mismatch: want 287082 got %s", got)
	}
}

func TestTOTP_VerifyRejectsWrongLength(t *testing.T) {
	secret, _ := GenerateTOTPSecret()
	ok, err := VerifyTOTP(secret, "123", time.Now())
	if err != nil || ok {
		t.Fatalf("3-digit code must not verify, ok=%v err=%v", ok, err)
	}
}

func TestTOTP_ProvisioningURIShape(t *testing.T) {
	uri := ProvisioningURI("ABCDEFG", "alice@x.com", "SDLC")
	if !strings.HasPrefix(uri, "otpauth://totp/SDLC:alice@x.com?") {
		t.Fatalf("unexpected uri prefix: %s", uri)
	}
	if !strings.Contains(uri, "secret=ABCDEFG") || !strings.Contains(uri, "issuer=SDLC") {
		t.Fatalf("uri missing required params: %s", uri)
	}
}

func TestNewMFA_RequiresStore(t *testing.T) {
	if _, err := NewMFA(nil); err == nil {
		t.Fatal("NewMFA(nil) must error")
	}
	m, err := NewMFA(&memMFAStore{})
	if err != nil {
		t.Fatalf("NewMFA: %v", err)
	}
	if m.Store() == nil {
		t.Fatal("Store() must be non-nil")
	}
	if m.WebAuthn() != nil {
		t.Fatal("WebAuthn() must be nil when not wired")
	}
}

func TestNewMFA_WithWebAuthn(t *testing.T) {
	wa, err := NewWebAuthnService(WebAuthnConfig{
		RPID:      "localhost",
		RPName:    "Test",
		RPOrigins: []string{"http://localhost:3000"},
	})
	if err != nil {
		t.Fatalf("NewWebAuthnService: %v", err)
	}
	m, err := NewMFA(&memMFAStore{}, WithWebAuthn(wa))
	if err != nil {
		t.Fatalf("NewMFA: %v", err)
	}
	if m.WebAuthn() != wa {
		t.Fatal("WebAuthn() must return the wired service")
	}
}
