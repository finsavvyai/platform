package storage

import (
	"errors"
	"strings"
	"testing"
)

// helper: stand up an in-memory DB and seed one user. Recovery codes
// depend on a real user_id FK, so every test in this file starts here.
func recoveryFixture(t *testing.T) (*DB, int64) {
	t.Helper()
	db, err := NewInMemory()
	if err != nil {
		t.Fatalf("NewInMemory: %v", err)
	}
	u, err := db.CreateUser("recovery@example.test", "hash", "Recovery Tester", "")
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	return db, u.ID
}

func TestGenerateRecoveryCodes_Count(t *testing.T) {
	db, uid := recoveryFixture(t)
	codes, err := db.GenerateRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("GenerateRecoveryCodes: %v", err)
	}
	if got := len(codes); got != RecoveryCodeCount {
		t.Fatalf("want %d codes, got %d", RecoveryCodeCount, got)
	}
	for i, c := range codes {
		if !strings.Contains(c, "-") {
			t.Errorf("code[%d] missing hyphen: %q", i, c)
		}
		if len(c) != 11 {
			t.Errorf("code[%d] wrong length: %q (want 11)", i, c)
		}
	}
}

func TestGenerateRecoveryCodes_AreUnique(t *testing.T) {
	db, uid := recoveryFixture(t)
	codes, err := db.GenerateRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("GenerateRecoveryCodes: %v", err)
	}
	seen := map[string]bool{}
	for _, c := range codes {
		if seen[c] {
			t.Fatalf("duplicate code: %q", c)
		}
		seen[c] = true
	}
}

func TestGenerateRecoveryCodes_ReplacesPrior(t *testing.T) {
	db, uid := recoveryFixture(t)
	first, err := db.GenerateRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("first gen: %v", err)
	}
	second, err := db.GenerateRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("second gen: %v", err)
	}
	for _, old := range first {
		if err := db.ConsumeRecoveryCode(uid, old); !errors.Is(err, ErrTokenInvalid) {
			t.Fatalf("old code %q should be ErrTokenInvalid after regen, got %v", old, err)
		}
	}
	// New batch is usable.
	if err := db.ConsumeRecoveryCode(uid, second[0]); err != nil {
		t.Fatalf("new code should consume, got %v", err)
	}
}

func TestConsumeRecoveryCode_HappyPath(t *testing.T) {
	db, uid := recoveryFixture(t)
	codes, err := db.GenerateRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("gen: %v", err)
	}
	if err := db.ConsumeRecoveryCode(uid, codes[0]); err != nil {
		t.Fatalf("consume: %v", err)
	}
}

func TestConsumeRecoveryCode_OneShot(t *testing.T) {
	db, uid := recoveryFixture(t)
	codes, err := db.GenerateRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("gen: %v", err)
	}
	if err := db.ConsumeRecoveryCode(uid, codes[0]); err != nil {
		t.Fatalf("first consume: %v", err)
	}
	if err := db.ConsumeRecoveryCode(uid, codes[0]); !errors.Is(err, ErrTokenInvalid) {
		t.Fatalf("second consume should be ErrTokenInvalid, got %v", err)
	}
}

func TestConsumeRecoveryCode_UnknownCode(t *testing.T) {
	db, uid := recoveryFixture(t)
	if err := db.ConsumeRecoveryCode(uid, "zzzzz-zzzzz"); !errors.Is(err, ErrTokenInvalid) {
		t.Fatalf("unknown code should be ErrTokenInvalid, got %v", err)
	}
}

func TestConsumeRecoveryCode_WrongUser(t *testing.T) {
	db, uid := recoveryFixture(t)
	codes, err := db.GenerateRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("gen: %v", err)
	}
	other, err := db.CreateUser("other@example.test", "hash", "Other", "")
	if err != nil {
		t.Fatalf("CreateUser other: %v", err)
	}
	if err := db.ConsumeRecoveryCode(other.ID, codes[0]); !errors.Is(err, ErrTokenInvalid) {
		t.Fatalf("foreign-user redeem should be ErrTokenInvalid, got %v", err)
	}
	// Original owner can still use it.
	if err := db.ConsumeRecoveryCode(uid, codes[0]); err != nil {
		t.Fatalf("owner consume should succeed, got %v", err)
	}
}

func TestConsumeRecoveryCode_CaseAndSpaceTolerant(t *testing.T) {
	// Users paste codes from print-outs / password managers — the hash
	// helper normalises case + whitespace. Confirm a noisy paste still
	// redeems.
	db, uid := recoveryFixture(t)
	codes, err := db.GenerateRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("gen: %v", err)
	}
	noisy := "  " + strings.ToUpper(codes[0]) + " "
	if err := db.ConsumeRecoveryCode(uid, noisy); err != nil {
		t.Fatalf("noisy redeem should succeed, got %v", err)
	}
}

func TestCountUnusedRecoveryCodes(t *testing.T) {
	db, uid := recoveryFixture(t)
	codes, err := db.GenerateRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("gen: %v", err)
	}
	n, err := db.CountUnusedRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != RecoveryCodeCount {
		t.Fatalf("want %d unused, got %d", RecoveryCodeCount, n)
	}
	if err := db.ConsumeRecoveryCode(uid, codes[0]); err != nil {
		t.Fatalf("consume: %v", err)
	}
	n, err = db.CountUnusedRecoveryCodes(uid)
	if err != nil {
		t.Fatalf("count after consume: %v", err)
	}
	if n != RecoveryCodeCount-1 {
		t.Fatalf("want %d unused after consume, got %d", RecoveryCodeCount-1, n)
	}
}
