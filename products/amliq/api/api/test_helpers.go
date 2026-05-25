package api

import (
	"encoding/json"
	"time"
)

func makeTestToken(secret string, tenantID, userID, role string, exp int64) string {
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	hbytes, _ := json.Marshal(header)
	hencoded := base64urlEncode(hbytes)

	claims := map[string]interface{}{
		"tenant_id": tenantID,
		"user_id":   userID,
		"role":      role,
		"exp":       exp,
		"iat":       time.Now().Unix(),
	}
	cbytes, _ := json.Marshal(claims)
	cencoded := base64urlEncode(cbytes)

	msg := hencoded + "." + cencoded
	sig := signHS256(msg, secret)

	return msg + "." + sig
}
