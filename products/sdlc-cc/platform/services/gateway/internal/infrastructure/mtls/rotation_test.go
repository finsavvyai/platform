package mtls

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// makeCert produces a self-signed cert+key pair for tests.
func makeCert(t *testing.T, cn string) *tls.Certificate {
	t.Helper()
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject:      pkix.Name{CommonName: cn},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &priv.PublicKey, priv)
	require.NoError(t, err)
	return &tls.Certificate{Certificate: [][]byte{der}, PrivateKey: priv}
}

// fakeSource swaps the cert it returns each Fetch so the rotator
// has something to observe.
type fakeSource struct {
	calls atomic.Int32
	certs []*tls.Certificate
}

func (f *fakeSource) Name() string { return "fake" }
func (f *fakeSource) Fetch(_ context.Context) (*tls.Certificate, error) {
	idx := int(f.calls.Add(1)) - 1
	if idx >= len(f.certs) {
		idx = len(f.certs) - 1
	}
	return f.certs[idx], nil
}

func TestNewRotator_FailsOnInitialFetchError(t *testing.T) {
	bad := errSource{}
	_, err := NewRotator(context.Background(), bad, 0, nil)
	assert.Error(t, err, "initial Fetch error must abort startup")
}

type errSource struct{}

func (errSource) Name() string                                   { return "err" }
func (errSource) Fetch(_ context.Context) (*tls.Certificate, error) { return nil, assert.AnError }

func TestRotator_CurrentReturnsInitialCert(t *testing.T) {
	c1 := makeCert(t, "v1")
	src := &fakeSource{certs: []*tls.Certificate{c1}}
	r, err := NewRotator(context.Background(), src, time.Hour, logrus.New())
	require.NoError(t, err)
	defer r.Stop()

	got := r.Current()
	require.NotNil(t, got)
	assert.Same(t, c1, got, "Current must return the cert from initial Fetch")
}

func TestRotator_LoopSwapsCertOnTick(t *testing.T) {
	c1 := makeCert(t, "v1")
	c2 := makeCert(t, "v2")
	src := &fakeSource{certs: []*tls.Certificate{c1, c2, c2, c2}}
	logger := logrus.New()
	logger.SetOutput(devNull{})
	r, err := NewRotator(context.Background(), src, 5*time.Millisecond, logger)
	require.NoError(t, err)

	r.Start(context.Background())
	defer r.Stop()

	// Wait until the rotator has called Fetch at least twice (initial
	// + one tick). The atomic ensures this is race-free.
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if src.calls.Load() >= 2 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	assert.GreaterOrEqual(t, int(src.calls.Load()), 2, "rotator must call Fetch on tick")

	// And Current should now reflect c2 (atomic swap).
	deadline = time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if r.Current() == c2 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	assert.Same(t, c2, r.Current(), "Current must reflect the latest Fetch")
}

func TestRotator_GetClientCertificateHook(t *testing.T) {
	c := makeCert(t, "v1")
	src := &fakeSource{certs: []*tls.Certificate{c}}
	r, err := NewRotator(context.Background(), src, time.Hour, nil)
	require.NoError(t, err)
	defer r.Stop()

	got, err := r.GetClientCertificate(nil)
	require.NoError(t, err)
	assert.Same(t, c, got)
}

func TestFileCertSource_FetchRoundTrip(t *testing.T) {
	dir := t.TempDir()
	certPath := filepath.Join(dir, "client.crt")
	keyPath := filepath.Join(dir, "client.key")

	cert := makeCert(t, "file-test")
	require.NoError(t, os.WriteFile(certPath,
		pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.Certificate[0]}), 0o600))
	priv := cert.PrivateKey.(*ecdsa.PrivateKey)
	keyBytes, err := x509.MarshalECPrivateKey(priv)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(keyPath,
		pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes}), 0o600))

	src := FileCertSource{CertFile: certPath, KeyFile: keyPath}
	got, err := src.Fetch(context.Background())
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.NotEmpty(t, got.Certificate)
}

func TestFileCertSource_MissingFileFailsLoud(t *testing.T) {
	src := FileCertSource{CertFile: "/no/such/cert", KeyFile: "/no/such/key"}
	_, err := src.Fetch(context.Background())
	assert.Error(t, err)
}

func TestVaultCertSource_NameComposes(t *testing.T) {
	// Real Fetch is exercised via httptest in vault_source_test.go.
	// This test just confirms the Name() format used in logs.
	src := &VaultCertSource{Mount: "pki", Role: "gateway"}
	assert.Equal(t, "vault:pki/gateway", src.Name())
}

type devNull struct{}

func (devNull) Write(p []byte) (int, error) { return len(p), nil }
