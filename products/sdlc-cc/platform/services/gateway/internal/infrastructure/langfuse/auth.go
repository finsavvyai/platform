package langfuse

import (
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
)

// AuthResolver maps Langfuse-style key pairs (publicKey, secretKey) to a
// gateway tenant ID. Implementations typically look up `pk_xxx` in the
// API keys table and validate `sk_xxx` against the stored secret.
type AuthResolver func(publicKey, secretKey string) (tenantID string, err error)

// BearerResolver maps a gateway bearer token (issued by /api/keys/generate)
// to a tenant ID. Either resolver may be set; if both are, Basic auth wins
// when both headers are present.
type BearerResolver func(token string) (tenantID string, err error)

// ErrUnauthorized indicates the credentials were absent or invalid.
var ErrUnauthorized = errors.New("langfuse: unauthorized")

// resolveTenant inspects the request and returns the tenant ID for whichever
// auth scheme the caller used. Langfuse SDKs use Basic; we additionally
// accept SDLC bearer tokens so polyglot apps can use one credential.
func resolveTenant(r *http.Request, basic AuthResolver, bearer BearerResolver) (string, error) {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return "", ErrUnauthorized
	}

	if strings.HasPrefix(auth, "Basic ") && basic != nil {
		raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(auth, "Basic "))
		if err != nil {
			return "", ErrUnauthorized
		}
		idx := strings.IndexByte(string(raw), ':')
		if idx <= 0 {
			return "", ErrUnauthorized
		}
		pk := string(raw[:idx])
		sk := string(raw[idx+1:])
		tenant, err := basic(pk, sk)
		if err != nil {
			return "", ErrUnauthorized
		}
		return tenant, nil
	}

	if strings.HasPrefix(auth, "Bearer ") && bearer != nil {
		token := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
		if token == "" {
			return "", ErrUnauthorized
		}
		tenant, err := bearer(token)
		if err != nil {
			return "", ErrUnauthorized
		}
		return tenant, nil
	}

	return "", ErrUnauthorized
}
