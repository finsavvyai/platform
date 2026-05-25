// REAL — drives the Vault HTTP API via httptest.NewServer so we test
// actual library wiring, not a fake. The Vault client honors any
// http(s) address; we point it at a local mock that mimics the JSON
// shape /v1/<mount>/issue/<role> returns.
package mtls

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func genPEMPair(t *testing.T, cn string) (string, string) {
	t.Helper()
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("genkey: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject:      pkix.Name{CommonName: cn},
		NotBefore:    time.Now().Add(-time.Minute),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &priv.PublicKey, priv)
	if err != nil {
		t.Fatalf("createcert: %v", err)
	}
	keyDER, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	cp := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
	kp := string(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))
	return cp, kp
}

type pathLog struct {
	mu sync.Mutex
	p  []string
}

func (l *pathLog) add(s string) { l.mu.Lock(); l.p = append(l.p, s); l.mu.Unlock() }
func (l *pathLog) snap() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]string, len(l.p))
	copy(out, l.p)
	return out
}

func mockVault(t *testing.T, log *pathLog, h http.HandlerFunc) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.add(r.URL.Path)
		h(w, r)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestVaultCertSource_Fetch_Success(t *testing.T) {
	log := &pathLog{}
	cp, kp := genPEMPair(t, "client.gateway")
	srv := mockVault(t, log, func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/issue/gateway") {
			http.Error(w, "bad path", http.StatusNotFound)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"data": map[string]interface{}{
				"certificate": cp, "private_key": kp,
				"ca_chain": []interface{}{},
			},
		})
	})
	src, err := NewVaultCertSource(srv.URL, "dev-token", "pki", "gateway", "client.gateway", time.Hour)
	if err != nil {
		t.Fatalf("ctor: %v", err)
	}
	cert, err := src.Fetch(context.Background())
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if cert == nil || len(cert.Certificate) == 0 {
		t.Fatal("expected populated tls.Certificate")
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		t.Fatalf("parse leaf: %v", err)
	}
	if leaf.Subject.CommonName != "client.gateway" {
		t.Fatalf("leaf CN = %q, want client.gateway", leaf.Subject.CommonName)
	}
}

func TestVaultCertSource_Fetch_Forbidden(t *testing.T) {
	log := &pathLog{}
	srv := mockVault(t, log, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"errors":["permission denied"]}`, http.StatusForbidden)
	})
	src, err := NewVaultCertSource(srv.URL, "bad-token", "pki", "gateway", "x", time.Minute)
	if err != nil {
		t.Fatalf("ctor: %v", err)
	}
	if _, err := src.Fetch(context.Background()); err == nil {
		t.Fatal("expected error on 403")
	}
}

func TestVaultCertSource_AppRoleAuth(t *testing.T) {
	t.Setenv("VAULT_APPROLE_ID", "role-id-1")
	t.Setenv("VAULT_APPROLE_SECRET_ID", "secret-id-1")
	log := &pathLog{}
	cp, kp := genPEMPair(t, "client.appr")
	srv := mockVault(t, log, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/auth/approle/login"):
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"auth": map[string]interface{}{"client_token": "approle-token-xyz"},
			})
		case strings.HasSuffix(r.URL.Path, "/issue/gateway"):
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"data": map[string]interface{}{"certificate": cp, "private_key": kp},
			})
		default:
			http.Error(w, "unknown", http.StatusNotFound)
		}
	})
	src, err := NewVaultCertSource(srv.URL, "", "pki", "gateway", "client.appr", time.Minute)
	if err != nil {
		t.Fatalf("ctor: %v", err)
	}
	if _, err := src.Fetch(context.Background()); err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	var sawLogin, sawIssue bool
	for _, p := range log.snap() {
		if strings.HasSuffix(p, "/auth/approle/login") {
			sawLogin = true
		}
		if strings.HasSuffix(p, "/issue/gateway") {
			sawIssue = true
		}
	}
	if !sawLogin || !sawIssue {
		t.Fatalf("expected login+issue calls, got %v", log.snap())
	}
}

func TestVaultCertSource_MalformedPEM(t *testing.T) {
	log := &pathLog{}
	srv := mockVault(t, log, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"data": map[string]interface{}{
				"certificate": "this is not pem", "private_key": "neither",
			},
		})
	})
	src, err := NewVaultCertSource(srv.URL, "tok", "pki", "gateway", "x", time.Minute)
	if err != nil {
		t.Fatalf("ctor: %v", err)
	}
	_, err = src.Fetch(context.Background())
	if err == nil || !strings.Contains(err.Error(), "parse PEM") {
		t.Fatalf("expected parse PEM error, got %v", err)
	}
}

func TestNewVaultCertSource_RequiredFields(t *testing.T) {
	t.Setenv("VAULT_APPROLE_ID", "")
	t.Setenv("VAULT_APPROLE_SECRET_ID", "")
	cases := [][6]string{
		{"missing addr", "", "t", "pki", "r", "cn"},
		{"missing mount", "http://x", "t", "", "r", "cn"},
		{"missing role", "http://x", "t", "pki", "", "cn"},
		{"missing cn", "http://x", "t", "pki", "r", ""},
		{"missing auth", "http://x", "", "pki", "r", "cn"},
	}
	for _, c := range cases {
		if _, err := NewVaultCertSource(c[1], c[2], c[3], c[4], c[5], time.Minute); err == nil {
			t.Fatalf("expected error for %s", c[0])
		}
	}
}
