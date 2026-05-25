package platform

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// verifySignature validates the CircleCI webhook HMAC-SHA256.
// Header format: "circleci-signature: v1=<hex>[,v1=<hex>]".
// CircleCI may emit multiple comma-separated "v1=" values during
// secret rotation — any match succeeds.
func (c *CircleCI) verifySignature(body []byte, sig string) error {
	if c.WebhookSecret == "" {
		return nil // skip if secret not configured (local dev only)
	}
	if sig == "" {
		return fmt.Errorf("missing circleci webhook signature")
	}
	mac := hmac.New(sha256.New, []byte(c.WebhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	for _, part := range strings.Split(sig, ",") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 || kv[0] != "v1" {
			continue
		}
		if hmac.Equal([]byte(expected), []byte(kv[1])) {
			return nil
		}
	}
	return fmt.Errorf("invalid circleci webhook signature")
}
