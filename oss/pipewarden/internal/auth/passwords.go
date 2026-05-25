package auth

import (
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

// MinPasswordLength is the floor we accept on signup. 12 chars is the
// 2026 NIST SP 800-63B baseline for human-chosen passwords without an
// MFA second factor. Below this we reject early and never hit bcrypt.
const MinPasswordLength = 12

// ErrPasswordTooShort signals the caller-visible policy violation. Map
// to HTTP 422 at the boundary; safe to surface the message verbatim.
var ErrPasswordTooShort = fmt.Errorf("password must be at least %d characters", MinPasswordLength)

// ErrInvalidCredentials is returned by VerifyPassword on mismatch.
// Generic on purpose — never leak whether the email or the password was
// the wrong half. Maps to HTTP 401.
var ErrInvalidCredentials = errors.New("invalid email or password")

// HashPassword runs bcrypt at cost 12 (current 2026 hardware budget for
// ~250ms per hash — slow enough to make offline cracking expensive,
// fast enough that login isn't perceptibly slow).
func HashPassword(plain string) (string, error) {
	if len(plain) < MinPasswordLength {
		return "", ErrPasswordTooShort
	}
	h, err := bcrypt.GenerateFromPassword([]byte(plain), 12)
	if err != nil {
		return "", fmt.Errorf("bcrypt: %w", err)
	}
	return string(h), nil
}

// VerifyPassword compares a plaintext attempt against a stored bcrypt
// hash in constant time. Returns ErrInvalidCredentials on mismatch so
// the caller can return 401 without branching on the underlying error.
func VerifyPassword(hash, plain string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)); err != nil {
		return ErrInvalidCredentials
	}
	return nil
}
