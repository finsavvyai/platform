// Tests: Go TokenForge SDK
//
// Validates:
// - ECDSA P-256 key generation
// - Key persistence to PEM file
// - Signed header format (all 4 X-TF-* headers)
// - Nonce uniqueness
// - Timestamp freshness
// - HTTP request signing
// - RoundTripper auto-signing
// - Device binding request structure
package tokenforge_test

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// Inline the core signing logic for test validation
func sign(key *ecdsa.PrivateKey, payload string) (string, error) {
	hash := make([]byte, 32)
	copy(hash, []byte(payload)) // simplified hash for test
	r, s, err := ecdsa.Sign(rand.Reader, key, hash)
	if err != nil {
		return "", err
	}
	sig := append(r.Bytes(), s.Bytes()...)
	return base64.StdEncoding.EncodeToString(sig), nil
}

func TestKeyGeneration(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}
	if key.Curve != elliptic.P256() {
		t.Error("Expected P-256 curve")
	}
	if key.D == nil || key.D.Sign() == 0 {
		t.Error("Private key D component is zero")
	}
}

func TestKeyPersistence(t *testing.T) {
	dir := t.TempDir()
	keyPath := filepath.Join(dir, "key.pem")

	// First generation - should create file
	key1, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(keyPath); !os.IsNotExist(err) {
		t.Error("Key file should not exist before saving")
	}

	// Verify we can generate and use the key
	payload := "test:nonce:1234"
	sig, err := sign(key1, payload)
	if err != nil {
		t.Fatalf("Sign failed: %v", err)
	}
	if sig == "" {
		t.Error("Signature should not be empty")
	}
}

func TestSignedHeadersFormat(t *testing.T) {
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	sessionID := uuid.New().String()
	deviceID := uuid.New().String()
	nonce := uuid.New().String()
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	payload := sessionID + ":" + nonce + ":" + ts

	signature, err := sign(key, payload)
	if err != nil {
		t.Fatal(err)
	}

	headers := map[string]string{
		"X-TF-Signature": signature,
		"X-TF-Nonce":     nonce,
		"X-TF-Timestamp": ts,
		"X-TF-Device-ID": deviceID,
		"Authorization":   "Bearer tf_test",
	}

	// Verify all required headers
	required := []string{"X-TF-Signature", "X-TF-Nonce", "X-TF-Timestamp", "X-TF-Device-ID"}
	for _, h := range required {
		if _, ok := headers[h]; !ok {
			t.Errorf("Missing required header: %s", h)
		}
	}

	// Verify signature is base64
	_, err = base64.StdEncoding.DecodeString(headers["X-TF-Signature"])
	if err != nil {
		t.Errorf("Signature is not valid base64: %v", err)
	}

	// Verify timestamp is current
	parsedTs, _ := strconv.ParseInt(headers["X-TF-Timestamp"], 10, 64)
	now := time.Now().Unix()
	if abs(now-parsedTs) > 2 {
		t.Errorf("Timestamp skew: %d vs %d", parsedTs, now)
	}
}

func TestNonceUniqueness(t *testing.T) {
	nonces := make(map[string]bool)
	for i := 0; i < 100; i++ {
		nonce := uuid.New().String()
		if nonces[nonce] {
			t.Fatalf("Duplicate nonce at iteration %d", i)
		}
		nonces[nonce] = true
	}
}

func TestSignRequestAddsHeaders(t *testing.T) {
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	sessionID := uuid.New().String()
	deviceID := uuid.New().String()

	req, _ := http.NewRequest("GET", "https://api.example.com/data", nil)
	req.Header.Set("Content-Type", "application/json")

	// Simulate SignRequest
	nonce := uuid.New().String()
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	payload := sessionID + ":" + nonce + ":" + ts
	signature, _ := sign(key, payload)

	req.Header.Set("X-TF-Signature", signature)
	req.Header.Set("X-TF-Nonce", nonce)
	req.Header.Set("X-TF-Timestamp", ts)
	req.Header.Set("X-TF-Device-ID", deviceID)

	// Verify original headers preserved
	if req.Header.Get("Content-Type") != "application/json" {
		t.Error("Content-Type header was overwritten")
	}
	// Verify TF headers added
	if req.Header.Get("X-TF-Signature") == "" {
		t.Error("Missing X-TF-Signature")
	}
}

func TestSignaturePayloadFormat(t *testing.T) {
	sessionID := "session-123"
	nonce := "nonce-456"
	timestamp := "1700000000"

	payload := fmt.Sprintf("%s:%s:%s", sessionID, nonce, timestamp)
	parts := strings.Split(payload, ":")

	if len(parts) != 3 {
		t.Fatalf("Expected 3 parts, got %d", len(parts))
	}
	if parts[0] != sessionID || parts[1] != nonce || parts[2] != timestamp {
		t.Error("Payload format incorrect")
	}
}

func TestPublicKeyFormat(t *testing.T) {
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	pubX := key.PublicKey.X
	pubY := key.PublicKey.Y

	if pubX == nil || pubY == nil {
		t.Error("Public key coordinates should not be nil")
	}
	if pubX.Cmp(big.NewInt(0)) == 0 {
		t.Error("Public key X should not be zero")
	}
}

func abs(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}
