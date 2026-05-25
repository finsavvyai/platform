package storage

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// PasskeyRecord is a single WebAuthn credential bound to a user. We
// never store the user's authenticator (the device) — only the public
// credential it returned during registration. SignCount is the
// monotonic counter the device increments on each assertion; mismatches
// indicate cloned authenticators.
type PasskeyRecord struct {
	ID           int64     `json:"id"`
	UserID       int64     `json:"user_id"`
	CredentialID []byte    `json:"credential_id"`
	PublicKey    []byte    `json:"-"`
	SignCount    uint32    `json:"sign_count"`
	Transports   string    `json:"transports"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
}

// CreatePasskey persists a freshly-registered WebAuthn credential.
func (s *DB) CreatePasskey(p PasskeyRecord) (*PasskeyRecord, error) {
	q := s.dialectPlaceholders(`INSERT INTO passkey_credentials (user_id, credential_id, public_key, sign_count, transports, name) VALUES (?, ?, ?, ?, ?, ?)`)
	_, err := s.db.Exec(q, p.UserID, p.CredentialID, p.PublicKey, p.SignCount, p.Transports, p.Name)
	if err != nil {
		return nil, fmt.Errorf("insert passkey: %w", err)
	}
	return s.GetPasskeyByCredentialID(p.CredentialID)
}

// ListPasskeysForUser returns every credential the user has registered.
// Used by both the management UI ("here are your devices") and the
// WebAuthn login ceremony (server needs the allowed-credentials list).
func (s *DB) ListPasskeysForUser(userID int64) ([]PasskeyRecord, error) {
	q := s.dialectPlaceholders(`SELECT id, user_id, credential_id, public_key, sign_count, transports, name, created_at FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC`)
	rows, err := s.db.Query(q, userID)
	if err != nil {
		return nil, fmt.Errorf("list passkeys: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []PasskeyRecord
	for rows.Next() {
		var p PasskeyRecord
		if err := rows.Scan(&p.ID, &p.UserID, &p.CredentialID, &p.PublicKey, &p.SignCount, &p.Transports, &p.Name, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan passkey: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// GetPasskeyByCredentialID lookups by the device-issued credential ID.
// Returns ErrUserNotFound (overloaded for any "no row" case) when missing.
func (s *DB) GetPasskeyByCredentialID(credentialID []byte) (*PasskeyRecord, error) {
	q := s.dialectPlaceholders(`SELECT id, user_id, credential_id, public_key, sign_count, transports, name, created_at FROM passkey_credentials WHERE credential_id = ?`)
	row := s.db.QueryRow(q, credentialID)
	var p PasskeyRecord
	err := row.Scan(&p.ID, &p.UserID, &p.CredentialID, &p.PublicKey, &p.SignCount, &p.Transports, &p.Name, &p.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scan passkey: %w", err)
	}
	return &p, nil
}

// UpdatePasskeySignCount bumps the monotonic counter after a successful
// assertion. Called from the login ceremony to keep clone-detection
// state in sync.
func (s *DB) UpdatePasskeySignCount(id int64, count uint32) error {
	q := s.dialectPlaceholders(`UPDATE passkey_credentials SET sign_count = ? WHERE id = ?`)
	_, err := s.db.Exec(q, count, id)
	if err != nil {
		return fmt.Errorf("update sign_count: %w", err)
	}
	return nil
}

// DeletePasskey removes a credential by its primary key, scoped to the
// owning user so other users can't drop your credentials by guessing IDs.
func (s *DB) DeletePasskey(userID, passkeyID int64) error {
	q := s.dialectPlaceholders(`DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?`)
	res, err := s.db.Exec(q, passkeyID, userID)
	if err != nil {
		return fmt.Errorf("delete passkey: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrUserNotFound
	}
	return nil
}

// SaveChallenge stashes a WebAuthn ceremony's session data (the random
// challenge + expected origin/RP) until the browser finishes the dance.
// Keyed by an opaque session_id we hand to the browser as a cookie.
// Expires after 5 minutes — covers typical user authenticator UI but
// not long enough to be a replay window.
func (s *DB) SaveChallenge(sessionID string, userID int64, sessionData, purpose string) error {
	expiresAt := time.Now().UTC().Add(5 * time.Minute)
	q := s.dialectPlaceholders(`INSERT INTO passkey_challenges (session_id, user_id, session_data, purpose, expires_at) VALUES (?, ?, ?, ?, ?)`)
	_, err := s.db.Exec(q, sessionID, userID, sessionData, purpose, expiresAt)
	return err
}

// LoadChallenge fetches and DELETES the stashed ceremony state. One-shot —
// each challenge is consumable exactly once to prevent replay.
func (s *DB) LoadChallenge(sessionID string) (userID int64, sessionData, purpose string, err error) {
	q := s.dialectPlaceholders(`SELECT user_id, session_data, purpose, expires_at FROM passkey_challenges WHERE session_id = ?`)
	row := s.db.QueryRow(q, sessionID)
	var expiresAt time.Time
	if err = row.Scan(&userID, &sessionData, &purpose, &expiresAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, "", "", ErrUserNotFound
		}
		return 0, "", "", fmt.Errorf("scan challenge: %w", err)
	}
	// Always consume — even if expired we don't want it lying around.
	delQ := s.dialectPlaceholders(`DELETE FROM passkey_challenges WHERE session_id = ?`)
	_, _ = s.db.Exec(delQ, sessionID)
	if time.Now().After(expiresAt) {
		return 0, "", "", fmt.Errorf("challenge expired")
	}
	return userID, sessionData, purpose, nil
}

// GetUserByGitHubID looks up a user by their GitHub user-ID. Returns
// ErrUserNotFound when no row matches — caller should create the user
// in that case (sign-in-with-GitHub == auto-provision).
func (s *DB) GetUserByGitHubID(githubID int64) (*UserRecord, error) {
	q := s.dialectPlaceholders(`SELECT id, email, password_hash, name, company, onboarded, email_verified, password_version, created_at, updated_at FROM users WHERE github_id = ?`)
	row := s.db.QueryRow(q, githubID)
	return scanUserRow(row)
}

// CreateUserFromGitHub provisions a new user from a verified GitHub
// OAuth identity. Password hash is empty — the user can only log in
// via GitHub (or add a password later via the settings flow).
func (s *DB) CreateUserFromGitHub(githubID int64, email, name string) (*UserRecord, error) {
	q := s.dialectPlaceholders(`INSERT INTO users (email, password_hash, name, github_id) VALUES (?, '', ?, ?)`)
	res, err := s.db.Exec(q, canonicalEmail(email), name, githubID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrUserExists
		}
		return nil, fmt.Errorf("insert github user: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return s.GetUserByEmail(email)
	}
	return s.GetUserByID(id)
}
