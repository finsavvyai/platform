package webhook

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"
)

// SecretPrefix is prepended to generated secrets.
const SecretPrefix = "whsec_"

// MaxSignatureAge limits replay attacks (5 minutes).
const MaxSignatureAge = 5 * time.Minute

// GenerateSecret creates a cryptographically random webhook secret.
// Format: whsec_<32-byte-hex>
func GenerateSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("rand: %w", err)
	}
	return SecretPrefix + hex.EncodeToString(b), nil
}

// Sign produces an HMAC-SHA256 signature for (timestamp + "." + body).
// Returns "t=<unix>,v1=<hex-sig>".
func Sign(secret string, body []byte) string {
	ts := time.Now().Unix()
	return SignWithTimestamp(secret, body, ts)
}

// SignWithTimestamp exposes the timestamp for deterministic testing.
func SignWithTimestamp(secret string, body []byte, ts int64) string {
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "%d.%s", ts, body)
	return fmt.Sprintf("t=%d,v1=%s", ts, hex.EncodeToString(mac.Sum(nil)))
}

// Verify checks the signature header against the body and secret.
// Returns nil if valid and within MaxSignatureAge.
func Verify(secret string, body []byte, sigHeader string) error {
	ts, sig, err := parseSignature(sigHeader)
	if err != nil {
		return err
	}
	if time.Since(time.Unix(ts, 0)) > MaxSignatureAge {
		return errors.New("signature expired")
	}
	expected := SignWithTimestamp(secret, body, ts)
	_, expectedSig, _ := parseSignature(expected)
	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return errors.New("signature mismatch")
	}
	return nil
}

func parseSignature(header string) (int64, string, error) {
	var ts int64
	var sig string
	for _, part := range splitPairs(header) {
		k, v, ok := cut(part, '=')
		if !ok {
			continue
		}
		switch k {
		case "t":
			parsed, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				return 0, "", fmt.Errorf("invalid timestamp: %w", err)
			}
			ts = parsed
		case "v1":
			sig = v
		}
	}
	if ts == 0 || sig == "" {
		return 0, "", errors.New("malformed signature header")
	}
	return ts, sig, nil
}

func splitPairs(s string) []string {
	var out []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			out = append(out, s[start:i])
			start = i + 1
		}
	}
	return append(out, s[start:])
}

func cut(s string, sep byte) (string, string, bool) {
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			return s[:i], s[i+1:], true
		}
	}
	return s, "", false
}
