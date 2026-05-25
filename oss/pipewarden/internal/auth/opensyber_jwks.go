package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"
)

// JWKS represents OpenSyber's JSON Web Key Set.
type JWKS struct {
	Keys []JWK `json:"keys"`
}

// JWK represents a single JSON Web Key.
type JWK struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

// refreshPublicKeys fetches the latest JWKS from OpenSyber.
func (a *OpenSyberAuth) refreshPublicKeys() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.publicKeyURL, nil)
	if err != nil {
		return fmt.Errorf("build JWKS request: %w", err)
	}
	resp, err := jwksHTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d fetching JWKS", resp.StatusCode)
	}

	var jwks JWKS
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("failed to parse JWKS: %w", err)
	}

	// Convert JWK to RSA public keys
	for _, key := range jwks.Keys {
		if key.Kty == "RSA" {
			pubKey, err := jwkToRSAPublicKey(&key)
			if err != nil {
				continue // Skip invalid keys
			}
			a.publicKeys[key.Kid] = pubKey
		}
	}

	if len(a.publicKeys) == 0 {
		return fmt.Errorf("no valid RSA keys found in JWKS")
	}

	return nil
}

// jwkToRSAPublicKey converts a JWK to an RSA public key.
func jwkToRSAPublicKey(jwk *JWK) (*rsa.PublicKey, error) {
	nBytes, err := base64urlDecode(jwk.N)
	if err != nil {
		return nil, fmt.Errorf("decode N: %w", err)
	}
	eBytes, err := base64urlDecode(jwk.E)
	if err != nil {
		return nil, fmt.Errorf("decode E: %w", err)
	}
	return &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: int(new(big.Int).SetBytes(eBytes).Int64()),
	}, nil
}

// base64urlDecode decodes base64url-encoded string.
func base64urlDecode(s string) ([]byte, error) {
	if padding := 4 - (len(s) % 4); padding != 4 {
		s += strings.Repeat("=", padding)
	}
	return base64.URLEncoding.DecodeString(s)
}
