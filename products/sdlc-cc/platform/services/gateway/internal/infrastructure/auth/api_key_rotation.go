// API key rotation lifecycle. The Rotator wraps a *sql.DB to issue a
// new key, mark the old one as rotating, and arm the grace window. A
// background Sweeper periodically revokes keys past their grace
// window or expiry. Both call sites are audited at the gateway HTTP
// layer.
//
// Day 9 of the production-ready roadmap.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Rotator issues + rotates + revokes API keys.
type Rotator struct {
	db                *sql.DB
	defaultGracePeriod time.Duration
	now               func() time.Time
}

// NewRotator wires a Rotator. defaultGrace is the rotation grace window
// applied when a caller does not specify one (24h is standard).
func NewRotator(db *sql.DB, defaultGrace time.Duration) *Rotator {
	if defaultGrace <= 0 {
		defaultGrace = 24 * time.Hour
	}
	return &Rotator{db: db, defaultGracePeriod: defaultGrace, now: time.Now}
}

// IssuedKey is the only place the plaintext secret leaves the rotator
// — return it to the caller, store only the hash. The caller MUST
// hand the plaintext to the user once and never persist it.
type IssuedKey struct {
	ID        uuid.UUID
	Plaintext string
	Prefix    string
	ExpiresAt *time.Time
}

// Rotate issues a new key and arms the rotation grace window on the
// old one. Both keys validate during the grace window; the old one is
// 401'd by the auth middleware after grace expires (handled by the
// Sweeper running concurrently).
func (r *Rotator) Rotate(ctx context.Context, oldKeyID uuid.UUID, gracePeriod time.Duration) (*IssuedKey, error) {
	if gracePeriod <= 0 {
		gracePeriod = r.defaultGracePeriod
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	var (
		tenantID   uuid.UUID
		userID     *uuid.UUID
		name       string
		isActive   bool
		revokedAt  *time.Time
	)
	if err := tx.QueryRowContext(ctx,
		`SELECT tenant_id, user_id, name, is_active, revoked_at
		 FROM api_keys WHERE id = $1`, oldKeyID,
	).Scan(&tenantID, &userID, &name, &isActive, &revokedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrKeyNotFound
		}
		return nil, err
	}
	if !isActive || revokedAt != nil {
		return nil, ErrKeyAlreadyRevoked
	}

	plaintext, prefix, hash, err := generateKey()
	if err != nil {
		return nil, fmt.Errorf("generate: %w", err)
	}

	now := r.now()
	expiresAt := now.Add(gracePeriod)
	newID := uuid.New()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO api_keys
		   (id, tenant_id, user_id, name, hash, key_hash, prefix, key_prefix,
		    is_active, rotated_from_key_id, rotation_grace_period_seconds,
		    created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$5,$6,$6,true,$7,$8,$9,$9)`,
		newID, tenantID, userID, name+" (rotated)", hash, prefix, oldKeyID,
		int(gracePeriod.Seconds()), now,
	); err != nil {
		return nil, fmt.Errorf("insert new: %w", err)
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE api_keys
		    SET rotation_started_at = $1, expires_at = $2, updated_at = $1
		  WHERE id = $3`,
		now, expiresAt, oldKeyID,
	); err != nil {
		return nil, fmt.Errorf("arm rotation: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &IssuedKey{
		ID:        newID,
		Plaintext: plaintext,
		Prefix:    prefix,
		ExpiresAt: nil,
	}, nil
}

// Revoke immediately revokes the key, ignoring any grace window. Used
// by admins for emergency revocation.
func (r *Rotator) Revoke(ctx context.Context, keyID uuid.UUID) error {
	now := r.now()
	res, err := r.db.ExecContext(ctx,
		`UPDATE api_keys
		    SET is_active = false, revoked_at = $1, updated_at = $1
		  WHERE id = $2 AND revoked_at IS NULL`,
		now, keyID,
	)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrKeyAlreadyRevoked
	}
	return nil
}

// Errors returned by the Rotator.
var (
	ErrKeyNotFound       = errors.New("apikey: not found")
	ErrKeyAlreadyRevoked = errors.New("apikey: already revoked")
)

func generateKey() (plaintext, prefix, hash string, err error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", "", err
	}
	plaintext = "sdlc_" + base64.RawURLEncoding.EncodeToString(raw)
	prefix = plaintext[:12]
	sum := sha256.Sum256([]byte(plaintext))
	hash = hex.EncodeToString(sum[:])
	return plaintext, prefix, hash, nil
}
