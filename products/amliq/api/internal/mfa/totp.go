package mfa

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"time"
)

// GenerateSecret creates a new TOTP secret (base32 encoded, 20 bytes).
func GenerateSecret() string {
	b := make([]byte, 20)
	rand.Read(b)
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
}

// GenerateRecoveryCodes creates 8 single-use recovery codes.
func GenerateRecoveryCodes() []string {
	codes := make([]string, 8)
	for i := range codes {
		b := make([]byte, 4)
		rand.Read(b)
		codes[i] = fmt.Sprintf("%08x", b)
	}
	return codes
}

// QRCodeURL returns the otpauth:// URI for QR code generation.
func QRCodeURL(secret, email, issuer string) string {
	return fmt.Sprintf(
		"otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
		issuer, email, secret, issuer,
	)
}

// Verify checks if the given code is valid for the secret.
// Allows ±1 time step for clock skew.
func Verify(secret, code string) bool {
	now := time.Now().Unix() / 30
	for delta := int64(-1); delta <= 1; delta++ {
		expected := generateCode(secret, now+delta)
		if expected == code {
			return true
		}
	}
	return false
}

func generateCode(secret string, counter int64) string {
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).
		DecodeString(strings.ToUpper(secret))
	if err != nil {
		return ""
	}
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(counter))
	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	code := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff
	otp := int(math.Mod(float64(code), 1e6))
	return fmt.Sprintf("%06d", otp)
}
