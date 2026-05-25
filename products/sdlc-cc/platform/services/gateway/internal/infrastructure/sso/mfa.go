// Per-tenant MFA enforcement primitives. Step-up auth for high-risk
// actions (key rotation, retention change, policy change) requires
// fresh MFA <5 minutes old.
//
// Day 24 of the production-ready roadmap.
//
// Real, working pieces:
//   - TOTP RFC 6238 generator + verifier (SHA-1, 30s window, 6 digits)
//     — implemented inline so we avoid adding github.com/pquerna/otp
//     to go.mod when the algorithm is small enough to own outright.
//   - Step-up freshness check (EnsureFreshMFA).
//   - WebAuthn (FIDO2/passkey) wired via webauthn.go using
//     github.com/go-webauthn/webauthn. Compose an MFA via
//     New(...WithWebAuthn(svc)) and reach the service through MFA.WebAuthn().
package sso

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1" // #nosec G505 -- TOTP RFC 6238 specifies HMAC-SHA1
	"encoding/base32"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// MFAFreshness is the maximum age of a successful MFA challenge
// before a step-up action requires a re-prompt.
const MFAFreshness = 5 * time.Minute

// totpDigits is the standard 6-digit RFC 6238 code length.
const totpDigits = 6

// totpStep is the standard 30-second TOTP window.
const totpStep = 30 * time.Second

// MFAStore tracks the most recent successful MFA challenge per user.
// Production wires Redis; tests pass in-memory.
type MFAStore interface {
	LastMFA(ctx context.Context, userID uuid.UUID) (time.Time, error)
	StampMFA(ctx context.Context, userID uuid.UUID) error
}

// ErrMFARequired signals the caller must re-prompt before allowing
// the action.
var ErrMFARequired = errors.New("sso: step-up MFA required")

// EnsureFreshMFA returns ErrMFARequired when the last successful MFA
// challenge is older than MFAFreshness.
func EnsureFreshMFA(ctx context.Context, store MFAStore, userID uuid.UUID, now func() time.Time) error {
	if now == nil {
		now = time.Now
	}
	last, err := store.LastMFA(ctx, userID)
	if err != nil {
		return err
	}
	if last.IsZero() || now().Sub(last) > MFAFreshness {
		return ErrMFARequired
	}
	return nil
}

// GenerateTOTPSecret returns a fresh base32-encoded shared secret for
// a user. 20 bytes = 160 bits = the RFC 4226 minimum.
func GenerateTOTPSecret() (string, error) {
	b := make([]byte, 20)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b), nil
}

// TOTPCode computes the current 6-digit TOTP code for secret at time t.
// Verifiers should call VerifyTOTP rather than recomputing this.
func TOTPCode(secretB32 string, t time.Time) (string, error) {
	key, err := decodeSecret(secretB32)
	if err != nil {
		return "", err
	}
	counter := uint64(t.UTC().Unix() / int64(totpStep.Seconds()))
	return hotp(key, counter), nil
}

// VerifyTOTP returns true when code matches the TOTP for secret at t
// or at t±1 step (to tolerate small clock drift).
func VerifyTOTP(secretB32, code string, t time.Time) (bool, error) {
	key, err := decodeSecret(secretB32)
	if err != nil {
		return false, err
	}
	code = strings.TrimSpace(code)
	if len(code) != totpDigits {
		return false, nil
	}
	now := uint64(t.UTC().Unix() / int64(totpStep.Seconds()))
	for _, off := range []int64{-1, 0, 1} {
		c := uint64(int64(now) + off)
		if hmac.Equal([]byte(hotp(key, c)), []byte(code)) {
			return true, nil
		}
	}
	return false, nil
}

// ProvisioningURI returns the otpauth:// URI a user can scan into an
// authenticator app (Google Authenticator, 1Password, etc.).
func ProvisioningURI(secretB32, account, issuer string) string {
	// Per the Google Authenticator key-uri-format spec.
	label := issuer + ":" + account
	return fmt.Sprintf(
		"otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d",
		label, secretB32, issuer, totpDigits, int(totpStep.Seconds()))
}

func decodeSecret(secretB32 string) ([]byte, error) {
	s := strings.ToUpper(strings.TrimSpace(secretB32))
	s = strings.TrimRight(s, "=")
	return base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(s)
}

// hotp implements RFC 4226 HOTP, the building block TOTP uses.
func hotp(key []byte, counter uint64) string {
	var ctr [8]byte
	binary.BigEndian.PutUint64(ctr[:], counter)
	mac := hmac.New(sha1.New, key)
	mac.Write(ctr[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	bin := (uint32(sum[offset]&0x7f) << 24) |
		(uint32(sum[offset+1]) << 16) |
		(uint32(sum[offset+2]) << 8) |
		uint32(sum[offset+3])
	mod := uint32(1)
	for i := 0; i < totpDigits; i++ {
		mod *= 10
	}
	return fmt.Sprintf("%0*d", totpDigits, bin%mod)
}

// MFA composes the per-tenant MFA primitives (TOTP, step-up, WebAuthn)
// behind one handle. Construction is option-style so callers wire only
// what they use; nil sub-services are honored as "feature disabled".
type MFA struct {
	store MFAStore
	wa    *WebAuthnService
}

// MFAOption configures an MFA at construction time.
type MFAOption func(*MFA)

// WithWebAuthn plugs a real WebAuthnService (see webauthn.go) into MFA.
func WithWebAuthn(wa *WebAuthnService) MFAOption {
	return func(m *MFA) { m.wa = wa }
}

// NewMFA composes an MFA. store is required; options are optional.
func NewMFA(store MFAStore, opts ...MFAOption) (*MFA, error) {
	if store == nil {
		return nil, errors.New("sso: MFAStore is required")
	}
	m := &MFA{store: store}
	for _, opt := range opts {
		opt(m)
	}
	return m, nil
}

// Store returns the underlying MFA freshness store.
func (m *MFA) Store() MFAStore { return m.store }

// WebAuthn returns the wired WebAuthn service or nil when the feature
// is not configured. Callers should check for nil before use.
func (m *MFA) WebAuthn() *WebAuthnService { return m.wa }
