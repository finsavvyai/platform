// Package lemonsqueezy implements the LemonSqueezy webhook receiver for
// the self-serve billing stack (Startup + Business tiers). It sits
// alongside the Stripe invoicing path in internal/infrastructure/billing/
// and shares the tenant_billing table introduced by migration 018.
//
// Bucket D of the integration-debt closeout plan.
package lemonsqueezy

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
)

// VerifySignature reports whether the X-Signature value from a
// LemonSqueezy webhook matches HMAC-SHA256(secret, body).
//
// LemonSqueezy computes: hex(HMAC-SHA256(webhookSecret, rawBody))
// and sets it in the X-Signature request header.
//
// The comparison uses subtle.ConstantTimeCompare so timing does not
// leak partial matches on the hex string.
func VerifySignature(payload []byte, signature, secret string) bool {
	if signature == "" || secret == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return subtle.ConstantTimeCompare([]byte(expected), []byte(signature)) == 1
}
