package auth

import (
	"errors"
	"strings"
	"testing"
)

func TestHashPassword_RejectsShort(t *testing.T) {
	_, err := HashPassword("short")
	if !errors.Is(err, ErrPasswordTooShort) {
		t.Errorf("expected ErrPasswordTooShort, got %v", err)
	}
}

func TestHashPassword_AcceptsAtMinimum(t *testing.T) {
	h, err := HashPassword(strings.Repeat("a", MinPasswordLength))
	if err != nil {
		t.Fatalf("min-length should be accepted: %v", err)
	}
	if !strings.HasPrefix(h, "$2") {
		t.Errorf("hash should be bcrypt format, got %q", h)
	}
}

func TestVerifyPassword_AcceptsCorrect(t *testing.T) {
	pw := "correct-horse-battery-staple"
	h, _ := HashPassword(pw)
	if err := VerifyPassword(h, pw); err != nil {
		t.Errorf("correct password should verify, got %v", err)
	}
}

func TestVerifyPassword_RejectsIncorrect(t *testing.T) {
	h, _ := HashPassword("correct-horse-battery-staple")
	err := VerifyPassword(h, "wrong-horse-battery-staple")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("wrong password should yield ErrInvalidCredentials, got %v", err)
	}
}

func TestVerifyPassword_RejectsMalformedHash(t *testing.T) {
	if err := VerifyPassword("not-a-bcrypt-hash", "anything"); !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("malformed hash should yield ErrInvalidCredentials, got %v", err)
	}
}
