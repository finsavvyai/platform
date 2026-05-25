package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

func VerifyWebhookSignature(payload []byte, signature, secret string) error {
	expectedMAC := hmac.New(sha256.New, []byte(secret))
	expectedMAC.Write(payload)
	expectedSignature := hex.EncodeToString(expectedMAC.Sum(nil))

	if !hmac.Equal([]byte(expectedSignature), []byte(signature)) {
		return fmt.Errorf("invalid signature")
	}
	return nil
}

func GenerateWebhookSignature(payload []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}
