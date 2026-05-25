package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strings"
)

func VerifyJWT(token, secret string) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, ErrInvalidFormat
	}

	header, payload, signature := parts[0], parts[1], parts[2]

	msg := header + "." + payload
	expectedSig := signHS256(msg, secret)

	if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
		return nil, ErrInvalidSignature
	}

	payloadBytes, err := base64urlDecode(payload)
	if err != nil {
		return nil, ErrInvalidFormat
	}

	claims, err := ClaimsFromPayload(payloadBytes)
	if err != nil {
		return nil, ErrInvalidFormat
	}

	if err := claims.Valid(); err != nil {
		return nil, err
	}

	return claims, nil
}

func signHS256(msg, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(msg))
	return base64urlEncode(h.Sum(nil))
}

func base64urlEncode(data []byte) string {
	s := base64.URLEncoding.EncodeToString(data)
	return strings.TrimRight(s, "=")
}

func base64urlDecode(s string) ([]byte, error) {
	s = strings.ReplaceAll(s, "-", "+")
	s = strings.ReplaceAll(s, "_", "/")
	for len(s)%4 != 0 {
		s += "="
	}
	return base64.StdEncoding.DecodeString(s)
}
