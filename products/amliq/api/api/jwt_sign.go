package api

import (
	"encoding/json"
	"time"
)

func SignJWT(tenantID, userID, role, secret string, expiry int) (string, error) {
	header := `{"alg":"HS256","typ":"JWT"}`
	headerB64 := base64urlEncode([]byte(header))

	claims := Claims{
		TenantID: tenantID,
		UserID:   userID,
		Role:     role,
		Iat:      time.Now().Unix(),
		Exp:      time.Now().Add(time.Duration(expiry) * time.Second).Unix(),
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payloadB64 := base64urlEncode(payload)

	msg := headerB64 + "." + payloadB64
	sig := signHS256(msg, secret)

	return msg + "." + sig, nil
}
