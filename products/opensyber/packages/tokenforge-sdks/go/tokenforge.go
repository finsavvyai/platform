// Package tokenforge provides device-bound ECDSA P-256 session security for Go.
package tokenforge

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/google/uuid"
)

const (
	defaultAPIBase = "https://tokenforge-api.opensyber.cloud"
	bindEndpoint   = "/v1/bind"
	keyFileName    = "key.pem"
)

// Client is a TokenForge device-bound session client.
type Client struct {
	APIKey    string
	APIBase   string
	DeviceID  string
	SessionID string
	key       *ecdsa.PrivateKey
}

// NewClient creates a TokenForge client with a fresh or persisted keypair.
// If keyDir is non-empty, the key is persisted to keyDir/key.pem.
func NewClient(apiKey string, keyDir string) (*Client, error) {
	c := &Client{
		APIKey:    apiKey,
		APIBase:   defaultAPIBase,
		DeviceID:  uuid.New().String(),
		SessionID: uuid.New().String(),
	}
	var err error
	if keyDir != "" {
		c.key, err = loadOrGenerateKey(keyDir)
	} else {
		c.key, err = ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	}
	if err != nil {
		return nil, fmt.Errorf("tokenforge: key setup failed: %w", err)
	}
	return c, nil
}

func loadOrGenerateKey(dir string) (*ecdsa.PrivateKey, error) {
	path := filepath.Join(dir, keyFileName)
	data, err := os.ReadFile(path)
	if err == nil {
		block, _ := pem.Decode(data)
		if block != nil {
			return x509.ParseECPrivateKey(block.Bytes)
		}
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	der, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return nil, err
	}
	pemBlock := &pem.Block{Type: "EC PRIVATE KEY", Bytes: der}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	return key, os.WriteFile(path, pem.EncodeToMemory(pemBlock), 0600)
}

func (c *Client) sign(payload string) (string, error) {
	hash := sha256.Sum256([]byte(payload))
	// DER-encoded signature; server normalizes both DER and raw r||s.
	// Avoids the leading-zero truncation bug of r.Bytes()||s.Bytes().
	sig, err := ecdsa.SignASN1(rand.Reader, c.key, hash[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

// GetHeaders returns signed TokenForge headers.
func (c *Client) GetHeaders() (map[string]string, error) {
	nonce := uuid.New().String()
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	payload := c.SessionID + ":" + nonce + ":" + ts
	sig, err := c.sign(payload)
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"X-TF-Signature": sig,
		"X-TF-Nonce":     nonce,
		"X-TF-Timestamp": ts,
		"X-TF-Device-ID": c.DeviceID,
		"Authorization":   "Bearer " + c.APIKey,
	}, nil
}

// SignRequest adds TokenForge headers to an http.Request.
func (c *Client) SignRequest(req *http.Request) error {
	headers, err := c.GetHeaders()
	if err != nil {
		return err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return nil
}

func (c *Client) publicKeyPEM() (string, error) {
	der, err := x509.MarshalPKIXPublicKey(&c.key.PublicKey)
	if err != nil {
		return "", err
	}
	pemBlock := &pem.Block{Type: "PUBLIC KEY", Bytes: der}
	return string(pem.EncodeToMemory(pemBlock)), nil
}

// Bind registers this device with the TokenForge API.
func (c *Client) Bind() error {
	pubPEM, err := c.publicKeyPEM()
	if err != nil {
		return err
	}
	body := map[string]string{
		"deviceId": c.DeviceID, "sessionId": c.SessionID, "publicKey": pubPEM,
	}
	data, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", c.APIBase+bindEndpoint, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("tokenforge: failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if err := c.SignRequest(req); err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("tokenforge: bind failed with status %d", resp.StatusCode)
	}
	return nil
}

// RoundTripper returns an http.RoundTripper that auto-signs requests.
func (c *Client) RoundTripper() http.RoundTripper {
	return &signingTransport{client: c, base: http.DefaultTransport}
}

type signingTransport struct {
	client *Client
	base   http.RoundTripper
}

func (t *signingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	clone := req.Clone(req.Context())
	if err := t.client.SignRequest(clone); err != nil {
		return nil, err
	}
	return t.base.RoundTrip(clone)
}
