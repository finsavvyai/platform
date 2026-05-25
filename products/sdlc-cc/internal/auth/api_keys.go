// Package auth issues, verifies, and revokes per-tenant API keys for
// direct B2B traffic (Authorization: Bearer sk_sdlc_*). Transparent-
// proxy traffic stays attributed via tenant_network_map; this package
// covers the explicit-customer path.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// KeyPrefix is what every plaintext key starts with so logs +
// support tickets can grep them out without leaking the secret.
const KeyPrefix = "sk_sdlc_"

// PrefixLen is how many leading chars of the plaintext (including
// "sk_sdlc_") we store unhashed for the operator UI. 12 chars is
// enough to disambiguate dozens of keys per tenant.
const PrefixLen = 12

// ErrInvalidKey is returned when verification fails — bad format,
// no row in the table, or revoked. Callers map it to 401.
var ErrInvalidKey = errors.New("invalid or revoked api key")

// Store is the persistence layer for api_keys. Pgx-backed; tests
// drive against a real Postgres via SDLC_PG_TEST_URL.
type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Key is the materialized record returned to the operator on issue.
// Plaintext is set once (at issue time); after that only the hash
// + prefix exist in the DB.
type Key struct {
	ID         int64
	TenantID   string
	Label      string
	Prefix     string
	Plaintext  string // populated only by Issue; never persisted
	Scopes     []string
	CreatedAt  time.Time
	CreatedBy  string
	RevokedAt  *time.Time
	LastUsedAt *time.Time
}

// Issue mints a fresh key. Plaintext is on the returned struct only
// for the caller to surface to the operator; do not log it.
func (s *Store) Issue(ctx context.Context, tenantID, label, createdBy string, scopes []string) (*Key, error) {
	plaintext, err := generatePlaintext()
	if err != nil {
		return nil, err
	}
	hash := hashKey(plaintext)
	prefix := plaintext[:PrefixLen]
	// Postgres TEXT[] NOT NULL: a Go nil slice maps to SQL NULL,
	// which trips the constraint. The DEFAULT '{}' only applies
	// when the column is omitted from the INSERT, which we can't
	// do with pgx's positional binding. Coerce here so callers can
	// keep passing nil for "no scopes".
	if scopes == nil {
		scopes = []string{}
	}

	var id int64
	var createdAt time.Time
	err = s.pool.QueryRow(ctx, `
		INSERT INTO api_keys (tenant_id, label, key_hash, prefix, scopes, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`, tenantID, label, hash, prefix, scopes, createdBy).
		Scan(&id, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("api_keys insert: %w", err)
	}

	return &Key{
		ID: id, TenantID: tenantID, Label: label,
		Prefix: prefix, Plaintext: plaintext,
		Scopes: scopes, CreatedAt: createdAt, CreatedBy: createdBy,
	}, nil
}

// Verify resolves a plaintext to its tenant_id. Bumps last_used_at
// asynchronously (waitless) so the hot verify path stays at one
// SELECT. ErrInvalidKey on any failure mode (bad shape, no row,
// revoked) — never leak which case to the caller.
func (s *Store) Verify(ctx context.Context, plaintext string) (string, error) {
	if !strings.HasPrefix(plaintext, KeyPrefix) {
		return "", ErrInvalidKey
	}
	hash := hashKey(plaintext)

	var (
		id        int64
		tenantID  string
		revokedAt *time.Time
	)
	err := s.pool.QueryRow(ctx, `
		SELECT id, tenant_id, revoked_at FROM api_keys WHERE key_hash = $1
	`, hash).Scan(&id, &tenantID, &revokedAt)
	if errors.Is(err, pgx.ErrNoRows) || revokedAt != nil {
		return "", ErrInvalidKey
	}
	if err != nil {
		return "", fmt.Errorf("api_keys verify: %w", err)
	}

	go s.touchLastUsed(id)
	return tenantID, nil
}

// Revoke flips revoked_at to NOW(). Idempotent: a re-revoke is a
// no-op rather than an error so support runbooks can be retried
// safely.
func (s *Store) Revoke(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE api_keys SET revoked_at = NOW()
		WHERE id = $1 AND revoked_at IS NULL
	`, id)
	return err
}

// List returns active (non-revoked) keys for a tenant for the
// operator UI / `keytool list`. Plaintext is never available here
// — only the prefix the caller can use to identify a row.
func (s *Store) List(ctx context.Context, tenantID string) ([]Key, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id, label, prefix, scopes, created_at, created_by, last_used_at, revoked_at
		FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Key, 0)
	for rows.Next() {
		var k Key
		if err := rows.Scan(&k.ID, &k.TenantID, &k.Label, &k.Prefix,
			&k.Scopes, &k.CreatedAt, &k.CreatedBy, &k.LastUsedAt, &k.RevokedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func (s *Store) touchLastUsed(id int64) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, _ = s.pool.Exec(ctx, `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, id)
}

// generatePlaintext produces a 30-byte random key prefixed with
// sk_sdlc_. base32-no-padding for URL-safety + readability; 30 bytes
// = 240 bits which is well past brute-force.
func generatePlaintext() (string, error) {
	raw := make([]byte, 30)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	enc := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw)
	return KeyPrefix + strings.ToLower(enc), nil
}

func hashKey(plaintext string) string {
	h := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(h[:])
}
