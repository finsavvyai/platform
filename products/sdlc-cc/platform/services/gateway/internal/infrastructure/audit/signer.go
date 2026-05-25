// Package audit provides HMAC-signed, append-only audit log writers
// and the reader primitives the admin API consumes.
//
// Every row carries a SHA-256 HMAC keyed by the AUDIT_SIGNING_KEY env
// var so post-hoc tampering is detectable without trusting the row's
// own columns. Day 12 of the production-ready roadmap.
package audit

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Signer wraps the signing key and exposes Sign + Verify primitives.
// Constructed once at startup from the AUDIT_SIGNING_KEY env var.
type Signer struct {
	key []byte
}

// NewSigner returns a Signer for the given key bytes. Returns an error
// when the key is shorter than 32 bytes (256-bit HMAC requires that
// minimum to retain the SHA-256 collision-resistance margin).
func NewSigner(key []byte) (*Signer, error) {
	if len(key) < 32 {
		return nil, ErrSigningKeyTooShort
	}
	return &Signer{key: key}, nil
}

// ErrSigningKeyTooShort is returned by NewSigner when the supplied key
// fails the minimum-length check.
var ErrSigningKeyTooShort = errors.New("audit: signing key must be >= 32 bytes")

// Row is the canonical subset of an audit row that gets signed. We
// deliberately omit fields a future migration might add so the
// signature stays stable across schema evolution.
type Row struct {
	TenantID   uuid.UUID
	ActorID    *uuid.UUID
	ActorType  string
	Action     string
	TargetType string
	TargetID   string
	Before     interface{}
	After      interface{}
	CreatedAt  time.Time
}

// Sign computes the HMAC-SHA256 signature for one row.
func (s *Signer) Sign(row Row) ([]byte, error) {
	canonical, err := canonicalize(row)
	if err != nil {
		return nil, fmt.Errorf("canonicalize: %w", err)
	}
	mac := hmac.New(sha256.New, s.key)
	mac.Write(canonical)
	return mac.Sum(nil), nil
}

// Verify returns true when the supplied signature matches the row.
func (s *Signer) Verify(row Row, signature []byte) (bool, error) {
	expected, err := s.Sign(row)
	if err != nil {
		return false, err
	}
	return hmac.Equal(expected, signature), nil
}

// canonicalize produces a deterministic byte representation of a row
// suitable for HMAC. We use compact JSON because the Before/After
// blobs are already JSONB on the wire; canonicalizing them avoids
// drift from key-order or whitespace changes between callers.
func canonicalize(row Row) ([]byte, error) {
	type wire struct {
		TenantID   string          `json:"tenant_id"`
		ActorID    string          `json:"actor_id,omitempty"`
		ActorType  string          `json:"actor_type"`
		Action     string          `json:"action"`
		TargetType string          `json:"target_type,omitempty"`
		TargetID   string          `json:"target_id,omitempty"`
		Before     json.RawMessage `json:"before,omitempty"`
		After      json.RawMessage `json:"after,omitempty"`
		CreatedAt  string          `json:"created_at"`
	}
	w := wire{
		TenantID:   row.TenantID.String(),
		ActorType:  row.ActorType,
		Action:     row.Action,
		TargetType: row.TargetType,
		TargetID:   row.TargetID,
		CreatedAt:  row.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
	if row.ActorID != nil {
		w.ActorID = row.ActorID.String()
	}
	if row.Before != nil {
		b, err := json.Marshal(row.Before)
		if err != nil {
			return nil, err
		}
		w.Before = b
	}
	if row.After != nil {
		b, err := json.Marshal(row.After)
		if err != nil {
			return nil, err
		}
		w.After = b
	}
	return json.Marshal(w)
}
