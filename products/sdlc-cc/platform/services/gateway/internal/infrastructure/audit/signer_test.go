package audit

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func makeSigner(t *testing.T) *Signer {
	t.Helper()
	s, err := NewSigner([]byte("0123456789abcdef0123456789abcdef")) // 32 bytes
	if err != nil {
		t.Fatalf("NewSigner: %v", err)
	}
	return s
}

func TestNewSigner_RejectsShortKey(t *testing.T) {
	_, err := NewSigner([]byte("short"))
	if !errors.Is(err, ErrSigningKeyTooShort) {
		t.Fatalf("want ErrSigningKeyTooShort, got %v", err)
	}
}

func TestSigner_SignAndVerify_Match(t *testing.T) {
	s := makeSigner(t)
	tenantID := uuid.New()
	row := Row{
		TenantID:  tenantID,
		ActorType: "user",
		Action:    "auth.login",
		CreatedAt: time.Unix(1_700_000_000, 0).UTC(),
	}

	sig, err := s.Sign(row)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	if len(sig) != 32 {
		t.Fatalf("HMAC-SHA256 must be 32 bytes, got %d", len(sig))
	}
	ok, err := s.Verify(row, sig)
	if err != nil || !ok {
		t.Fatalf("Verify must succeed, got ok=%v err=%v", ok, err)
	}
}

func TestSigner_TamperedRow_FailsVerify(t *testing.T) {
	s := makeSigner(t)
	row := Row{
		TenantID:  uuid.New(),
		ActorType: "user",
		Action:    "auth.login",
		CreatedAt: time.Now().UTC(),
	}
	sig, _ := s.Sign(row)

	tampered := row
	tampered.Action = "auth.logout"

	ok, err := s.Verify(tampered, sig)
	if err != nil {
		t.Fatalf("Verify should not error on tamper, got %v", err)
	}
	if ok {
		t.Fatal("Verify must return false when the row has been tampered")
	}
}

func TestSigner_SameRowDifferentKey_FailsVerify(t *testing.T) {
	s1, _ := NewSigner([]byte("0123456789abcdef0123456789abcdef"))
	s2, _ := NewSigner([]byte("ffffffffffffffffffffffffffffffff"))

	row := Row{TenantID: uuid.New(), ActorType: "user", Action: "x", CreatedAt: time.Now().UTC()}
	sig, _ := s1.Sign(row)
	ok, err := s2.Verify(row, sig)
	if err != nil {
		t.Fatalf("Verify error: %v", err)
	}
	if ok {
		t.Fatal("Verify must reject signatures from a different key")
	}
}

func TestSigner_Stable_AcrossKeyOrder(t *testing.T) {
	// JSON marshalling of a map sorts keys, so a Before payload built
	// from a map[string]interface{} should hash the same regardless of
	// insert order. Lock that in so the signature stays stable.
	s := makeSigner(t)
	now := time.Now().UTC()

	row1 := Row{
		TenantID:  uuid.UUID{},
		ActorType: "user",
		Action:    "x",
		CreatedAt: now,
		Before:    map[string]interface{}{"a": 1, "b": 2},
	}
	row2 := Row{
		TenantID:  uuid.UUID{},
		ActorType: "user",
		Action:    "x",
		CreatedAt: now,
		Before:    map[string]interface{}{"b": 2, "a": 1},
	}
	sig1, _ := s.Sign(row1)
	sig2, _ := s.Sign(row2)
	if string(sig1) != string(sig2) {
		t.Fatalf("signature must be stable across map key order")
	}
}
