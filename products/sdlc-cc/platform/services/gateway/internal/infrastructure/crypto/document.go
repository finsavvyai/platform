// DocumentEncryptor: tenant-aware envelope helper for the document
// storage path. BEAT-PLAN S3.1 follow-up.
//
// EncryptForTenant looks up the tenant's KEK ARN; when set, wraps the
// plaintext via the underlying Encryptor and returns the Envelope.
// When the tenant has no KEK ARN configured (i.e. platform-managed
// keys / non-CMEK plan), returns (nil, nil) so the caller can store
// the plaintext as-is.
//
// Decrypt is the inverse: pass the loaded Envelope, get plaintext.
// Returns ErrRevoked when the customer revoked their grant.
package crypto

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DocumentEncryptor wraps Encryptor with the tenant -> KEK ARN
// resolution that the document repo needs.
type DocumentEncryptor struct {
	enc  *Encryptor
	pool *pgxpool.Pool
}

// NewDocumentEncryptor wires the tenant lookup. enc is required;
// pool is required to read tenants.kms_key_arn.
func NewDocumentEncryptor(enc *Encryptor, pool *pgxpool.Pool) *DocumentEncryptor {
	if enc == nil || pool == nil {
		panic("crypto: encryptor + pool required")
	}
	return &DocumentEncryptor{enc: enc, pool: pool}
}

// EncryptForTenant returns (envelope, nil) when the tenant has a KEK
// configured, (nil, nil) when CMEK is not active for them. The repo
// stores documents.envelope = envelope and documents.kek_arn =
// envelope.KEKARN; when envelope is nil it stores plaintext content.
func (d *DocumentEncryptor) EncryptForTenant(ctx context.Context, tenantID uuid.UUID, plaintext []byte) (*Envelope, error) {
	arn, err := d.tenantKEK(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if arn == "" {
		return nil, nil
	}
	return d.enc.Encrypt(ctx, arn, plaintext)
}

// Decrypt returns the plaintext for the given Envelope. The caller
// MUST pass the row's stored envelope; we don't re-derive the ARN
// from tenant state because the customer may have rotated keys
// since write.
func (d *DocumentEncryptor) Decrypt(ctx context.Context, env *Envelope) ([]byte, error) {
	if env == nil {
		return nil, errors.New("crypto: envelope is nil — row may be plaintext; check before calling")
	}
	return d.enc.Decrypt(ctx, env)
}

// tenantKEK reads tenants.kms_key_arn for tenantID. Empty string
// means CMEK is off for the tenant; an actual error (DB down, etc.)
// propagates so the caller can fail closed.
func (d *DocumentEncryptor) tenantKEK(ctx context.Context, tenantID uuid.UUID) (string, error) {
	if tenantID == uuid.Nil {
		return "", nil
	}
	var arn *string
	err := d.pool.QueryRow(ctx,
		`SELECT kms_key_arn FROM tenants WHERE id = $1`, tenantID,
	).Scan(&arn)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("crypto: tenant kek lookup: %w", err)
	}
	if arn == nil {
		return "", nil
	}
	return *arn, nil
}
