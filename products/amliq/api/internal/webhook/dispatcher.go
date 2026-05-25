package webhook

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Dispatcher sends webhook payloads to registered endpoints.
type Dispatcher struct {
	client  *http.Client
	timeout time.Duration
}

// NewDispatcher creates a webhook dispatcher.
func NewDispatcher(timeout time.Duration) *Dispatcher {
	return &Dispatcher{
		client:  &http.Client{Timeout: timeout},
		timeout: timeout,
	}
}

// Send delivers a payload to an endpoint with HMAC signature.
func (d *Dispatcher) Send(
	endpoint domain.WebhookEndpoint, payload domain.WebhookPayload,
) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest("POST", endpoint.URL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Aegis-Event", string(payload.EventType))
	req.Header.Set("X-Aegis-Delivery", payload.ID)
	if endpoint.Secret != "" {
		sig := signPayload(body, endpoint.Secret)
		req.Header.Set("X-Aegis-Signature", sig)
	}
	resp, err := d.client.Do(req)
	if err != nil {
		log.Printf("webhook %s delivery failed: %v", endpoint.ID, err)
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("webhook %s returned %d", endpoint.ID, resp.StatusCode)
	}
	return nil
}

func signPayload(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}
