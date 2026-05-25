package storage

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"time"
)

// Auth token purposes — stored as TEXT so the DB schema doesn't need a
// migration when we add a new flow (e.g. magic-link login).
const (
	TokenPurposeEmailVerify   = "email_verify"
	TokenPurposePasswordReset = "password_reset"
)

// CreateAuthToken issues a one-shot URL-safe token for a user and stores
// it with the given purpose + TTL. Returns the bearer token the caller
// embeds in the email link.
func (s *DB) CreateAuthToken(userID int64, purpose string, ttl time.Duration) (string, error) {
	tok, err := randomToken()
	if err != nil {
		return "", err
	}
	q := s.dialectPlaceholders(`INSERT INTO auth_tokens (token, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)`)
	_, err = s.db.Exec(q, tok, userID, purpose, time.Now().UTC().Add(ttl))
	if err != nil {
		return "", fmt.Errorf("insert auth token: %w", err)
	}
	return tok, nil
}

// ConsumeAuthToken atomically marks a token used and returns the user_id
// it was issued to. Errors on missing, expired, or already-used tokens.
// Idempotent for the lifetime of the row — subsequent calls with the
// same token return ErrTokenInvalid.
func (s *DB) ConsumeAuthToken(token, expectedPurpose string) (int64, error) {
	q := s.dialectPlaceholders(`SELECT user_id, purpose, expires_at, used_at FROM auth_tokens WHERE token = ?`)
	row := s.db.QueryRow(q, token)
	var userID int64
	var purpose string
	var expiresAt time.Time
	var usedAt sql.NullTime
	if err := row.Scan(&userID, &purpose, &expiresAt, &usedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, ErrTokenInvalid
		}
		return 0, fmt.Errorf("scan auth token: %w", err)
	}
	if purpose != expectedPurpose {
		return 0, ErrTokenInvalid
	}
	if usedAt.Valid {
		return 0, ErrTokenInvalid
	}
	if time.Now().After(expiresAt) {
		return 0, ErrTokenInvalid
	}
	updateQ := s.dialectPlaceholders(`UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ? AND used_at IS NULL`)
	if s.driver == EnginePostgres {
		updateQ = `UPDATE auth_tokens SET used_at = NOW() WHERE token = $1 AND used_at IS NULL`
	}
	res, err := s.db.Exec(updateQ, token)
	if err != nil {
		return 0, fmt.Errorf("mark token used: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		// Lost the race with a concurrent consumer.
		return 0, ErrTokenInvalid
	}
	return userID, nil
}

// MarkEmailVerified flips the user's email_verified flag.
func (s *DB) MarkEmailVerified(userID int64) error {
	q := s.dialectPlaceholders(`UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
	if s.driver == EnginePostgres {
		q = `UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`
	}
	_, err := s.db.Exec(q, userID)
	return err
}

// UpdatePasswordHash rotates the user's bcrypt hash AND increments
// password_version so every existing session JWT becomes invalid.
// VerifySession reads the user's current password_version and refuses
// tokens whose embedded version is older — gives users an effective
// "log out everywhere" on password reset without a session-revocation
// table.
func (s *DB) UpdatePasswordHash(userID int64, newHash string) error {
	q := s.dialectPlaceholders(`UPDATE users SET password_hash = ?, password_version = password_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
	if s.driver == EnginePostgres {
		q = `UPDATE users SET password_hash = $1, password_version = password_version + 1, updated_at = NOW() WHERE id = $2`
	}
	_, err := s.db.Exec(q, newHash, userID)
	return err
}

// ErrTokenInvalid is the unified error for missing, expired, used, or
// wrong-purpose tokens. Generic on purpose — never leaks which case.
var ErrTokenInvalid = errors.New("token invalid or expired")

// randomToken returns 32 bytes of URL-safe entropy (~43 chars). Long
// enough that brute-force is infeasible within the 1-hour expiry window.
func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
