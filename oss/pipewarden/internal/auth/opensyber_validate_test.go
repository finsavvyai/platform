package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func newJWKSServer(t *testing.T, kid string, pub *rsa.PublicKey) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		jwks := JWKS{Keys: []JWK{{
			Kid: kid, Kty: "RSA", Use: "sig",
			N: encodeBase64URL(pub.N.Bytes()),
			E: encodeBase64URL(big.NewInt(int64(pub.E)).Bytes()),
		}}}
		_ = json.NewEncoder(w).Encode(jwks)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestValidateToken_NilReceiver(t *testing.T) {
	var a *OpenSyberAuth
	if _, err := a.ValidateToken("anything"); err == nil {
		t.Error("expected error from nil receiver")
	}
}

func TestValidateToken_WrongSigningMethod(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	srv := newJWKSServer(t, "k1", &priv.PublicKey)

	a, err := New(Config{Enabled: true, PublicKeyURL: srv.URL, Issuer: "iss", Audience: "aud"})
	if err != nil {
		t.Fatal(err)
	}

	// HS256 token instead of RS256 — should be rejected by keyfunc.
	hsToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "u", "iss": "iss", "aud": "aud",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	hsToken.Header["kid"] = "k1"
	signed, _ := hsToken.SignedString([]byte("secret"))

	if _, err := a.ValidateToken(signed); err == nil {
		t.Error("expected error for wrong signing method")
	}
}

func TestValidateToken_MissingKid(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	srv := newJWKSServer(t, "k1", &priv.PublicKey)

	a, err := New(Config{Enabled: true, PublicKeyURL: srv.URL, Issuer: "iss", Audience: "aud"})
	if err != nil {
		t.Fatal(err)
	}

	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "u", "iss": "iss", "aud": "aud",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	// Deliberately omit kid header.
	signed, _ := tok.SignedString(priv)

	if _, err := a.ValidateToken(signed); err == nil {
		t.Error("expected error when kid header missing")
	}
}

func TestValidateToken_UnknownKidRefreshFails(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	srv := newJWKSServer(t, "k1", &priv.PublicKey)

	a, err := New(Config{Enabled: true, PublicKeyURL: srv.URL, Issuer: "iss", Audience: "aud"})
	if err != nil {
		t.Fatal(err)
	}
	srv.Close() // make refresh fail

	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "u", "iss": "iss", "aud": "aud",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	tok.Header["kid"] = "unknown-kid"
	signed, _ := tok.SignedString(priv)

	if _, err := a.ValidateToken(signed); err == nil {
		t.Error("expected error when refresh fails to find unknown kid")
	}
}

func TestValidateToken_InvalidAudience(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	srv := newJWKSServer(t, "test-key", &priv.PublicKey)

	a, err := New(Config{Enabled: true, PublicKeyURL: srv.URL, Issuer: "iss", Audience: "right-aud"})
	if err != nil {
		t.Fatal(err)
	}

	tokenStr, err := createTestToken(priv, "iss", "wrong-aud")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := a.ValidateToken(tokenStr); err == nil {
		t.Error("expected invalid audience error")
	}
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	srv := newJWKSServer(t, "test-key", &priv.PublicKey)

	a, err := New(Config{Enabled: true, PublicKeyURL: srv.URL, Issuer: "iss", Audience: "aud"})
	if err != nil {
		t.Fatal(err)
	}

	claims := jwt.MapClaims{
		"sub": "u", "iss": "iss", "aud": "aud",
		"exp": time.Now().Add(-time.Hour).Unix(), // expired
		"iat": time.Now().Add(-2 * time.Hour).Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = "test-key"
	signed, _ := tok.SignedString(priv)

	if _, err := a.ValidateToken(signed); err == nil {
		t.Error("expected error on expired token")
	}
}

func TestMiddleware_InvalidBearerFormat(t *testing.T) {
	a := &OpenSyberAuth{}
	handler := a.Middleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	cases := []string{"NotBearer foo", "Bearer", "Basic dXNlcjpwYXNz"}
	for _, raw := range cases {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", raw)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("authorization=%q: code=%d, want 401", raw, rec.Code)
		}
	}
}

func TestMiddleware_BadToken(t *testing.T) {
	a := &OpenSyberAuth{publicKeys: map[string]*rsa.PublicKey{}}
	handler := a.Middleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer not-a-real-jwt")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", rec.Code)
	}
}

func TestContains(t *testing.T) {
	if !contains([]string{"a", "b", "c"}, "b") {
		t.Error("expected b in slice")
	}
	if contains([]string{"a", "b"}, "z") {
		t.Error("did not expect z in slice")
	}
	if contains(nil, "x") {
		t.Error("nil slice should not contain x")
	}
	if contains([]string{}, "x") {
		t.Error("empty slice should not contain x")
	}
}
