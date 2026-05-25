package api

import (
	"crypto/sha256"
	"encoding/hex"
)

func HashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

func VerifyAPIKeyHash(key, hash string) bool {
	return HashAPIKey(key) == hash
}
