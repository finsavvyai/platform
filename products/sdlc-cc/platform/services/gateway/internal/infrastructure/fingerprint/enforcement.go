// Per-tenant device-fingerprint enforcement.
//
// Day 10 of the production-ready roadmap. The fingerprint package
// already exposes Extract / Hash / Matches; this file adds the
// similarity-threshold policy + the SessionStore needed to detect a
// drifted device.
//
// Threshold semantics: 0..100 (higher = stricter). 80 means a
// fingerprint must match >= 80% of canonical signal slots to be
// considered the same device. Below threshold => the auth middleware
// emits a re-auth challenge.
package fingerprint

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Policy carries the per-tenant similarity threshold. Stored in the
// tenants config blob; a missing entry means "use default".
type Policy struct {
	Threshold int // 0..100; 80 is the default for new tenants.
}

// DefaultThreshold is applied when a tenant has no override.
const DefaultThreshold = 80

// Decision is the outcome of an enforcement check.
type Decision struct {
	Match            bool    // true when score >= threshold.
	Score            int     // 0..100 similarity score
	Threshold        int     // the threshold the score was compared against
	RequireMFA       bool    // true when Match is false
	StoredHash       string  // the fingerprint we expected to see
	NewHash          string  // the fingerprint observed on this request
}

// SessionStore persists the canonical fingerprint string observed on
// session start so subsequent requests can be compared against it.
// The stored value is the pipe-joined canonical (NOT the SHA-256
// hash) because we need part-by-part similarity, not just equality.
// Tests pass an in-memory implementation; production uses Redis.
type SessionStore interface {
	GetFingerprint(ctx context.Context, sessionID uuid.UUID) (string, error)
	PutFingerprint(ctx context.Context, sessionID uuid.UUID, canonical string, ttl time.Duration) error
}

// PolicyResolver returns the per-tenant fingerprint policy.
// Implementations can read tenants.config or any cache.
type PolicyResolver interface {
	Resolve(ctx context.Context, tenantID uuid.UUID) (Policy, error)
}

// ErrNoStoredFingerprint signals "first request of this session" — the
// caller stamps the freshly-extracted hash and proceeds.
var ErrNoStoredFingerprint = errors.New("fingerprint: no stored value for session")

// Enforcer wires SessionStore + PolicyResolver. Goroutine-safe.
type Enforcer struct {
	Store    SessionStore
	Policies PolicyResolver
	TTL      time.Duration
}

// NewEnforcer wires a default 30-day TTL when ttl is zero.
func NewEnforcer(store SessionStore, policies PolicyResolver, ttl time.Duration) *Enforcer {
	if ttl <= 0 {
		ttl = 30 * 24 * time.Hour
	}
	return &Enforcer{Store: store, Policies: policies, TTL: ttl}
}

// Check compares the freshly-extracted fingerprint against the one
// previously stamped on the session. First-touch sessions stamp and
// return Match=true. Drift past the policy threshold returns
// RequireMFA=true so the gateway can demand re-auth.
func (e *Enforcer) Check(ctx context.Context, sessionID, tenantID uuid.UUID, current Signals) (Decision, error) {
	policy, err := e.Policies.Resolve(ctx, tenantID)
	if err != nil {
		return Decision{}, err
	}
	threshold := policy.Threshold
	if threshold <= 0 {
		threshold = DefaultThreshold
	}

	newCanonical := strings.Join(current.canonicalParts(), "|")
	newHash := current.Hash()

	stored, err := e.Store.GetFingerprint(ctx, sessionID)
	if errors.Is(err, ErrNoStoredFingerprint) {
		_ = e.Store.PutFingerprint(ctx, sessionID, newCanonical, e.TTL)
		return Decision{Match: true, Score: 100, Threshold: threshold, NewHash: newHash}, nil
	}
	if err != nil {
		return Decision{}, err
	}

	score := similarityCanonical(stored, newCanonical)
	d := Decision{
		Match:      score >= threshold,
		Score:      score,
		Threshold:  threshold,
		RequireMFA: score < threshold,
		StoredHash: hashOfCanonical(stored),
		NewHash:    newHash,
	}
	return d, nil
}

// Stamp explicitly stores a fingerprint after a successful re-auth.
// Called by the auth middleware after the user clears the MFA gate.
func (e *Enforcer) Stamp(ctx context.Context, sessionID uuid.UUID, current Signals) error {
	canonical := strings.Join(current.canonicalParts(), "|")
	return e.Store.PutFingerprint(ctx, sessionID, canonical, e.TTL)
}

// similarityCanonical compares two pipe-joined canonical fingerprint
// strings part-by-part. Each matching slot contributes equally to the
// 0..100 score. A length mismatch (format rollover) returns 0 so the
// session re-auths.
func similarityCanonical(stored, current string) int {
	if stored == current {
		return 100
	}
	a := strings.Split(stored, "|")
	b := strings.Split(current, "|")
	if len(a) != len(b) || len(b) == 0 {
		return 0
	}
	matched := 0
	for i := range a {
		if a[i] == b[i] {
			matched++
		}
	}
	return (matched * 100) / len(b)
}

func hashOfCanonical(canonical string) string {
	sum := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(sum[:])
}
