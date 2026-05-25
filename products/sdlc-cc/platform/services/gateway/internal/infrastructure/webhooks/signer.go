// Package webhooks provides signed, retried, idempotent outbound
// webhook delivery.
//
// Day 38 of the production-ready roadmap.
//
// Every payload is signed with HMAC-SHA256 + timestamp + nonce so
// receivers can reject replays. Retry: 30s/2m/10m/1h/4h, max 5
// attempts, then DLQ.
package webhooks

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"
)

// SignedHeaders is the canonical webhook signing scheme:
//
//	X-SDLC-Timestamp: 1700000000
//	X-SDLC-Nonce:     <base64>
//	X-SDLC-Signature: <hex hmac>
//
// Receivers verify by recomputing HMAC over `timestamp.nonce.body`.
type SignedHeaders struct {
	Timestamp string
	Nonce     string
	Signature string
}

// Sign produces SignedHeaders for the given body bytes. Returns the
// timestamp/nonce/signature triple the caller sets on the outbound
// request.
func Sign(secret []byte, body []byte, now func() time.Time) (SignedHeaders, error) {
	if now == nil {
		now = time.Now
	}
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return SignedHeaders{}, err
	}
	nonce := base64.RawURLEncoding.EncodeToString(nonceBytes)
	ts := fmt.Sprintf("%d", now().Unix())

	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(ts))
	mac.Write([]byte("."))
	mac.Write([]byte(nonce))
	mac.Write([]byte("."))
	mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))

	return SignedHeaders{Timestamp: ts, Nonce: nonce, Signature: sig}, nil
}

// Verify recomputes the HMAC and rejects when:
//   - the timestamp is older than tolerance (replay window)
//   - the signature does not match
//
// Receivers should additionally maintain a nonce cache (LRU sized to
// the throughput-volume) to reject exact-replay even within tolerance.
func Verify(secret []byte, body []byte, h SignedHeaders, tolerance time.Duration, now func() time.Time) error {
	if now == nil {
		now = time.Now
	}
	var ts int64
	if _, err := fmt.Sscanf(h.Timestamp, "%d", &ts); err != nil {
		return fmt.Errorf("webhooks: bad timestamp: %w", err)
	}
	if delta := now().Unix() - ts; delta > int64(tolerance.Seconds()) || delta < -int64(tolerance.Seconds()) {
		return fmt.Errorf("webhooks: timestamp outside %s tolerance", tolerance)
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(h.Timestamp))
	mac.Write([]byte("."))
	mac.Write([]byte(h.Nonce))
	mac.Write([]byte("."))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(h.Signature)) {
		return fmt.Errorf("webhooks: signature mismatch")
	}
	return nil
}

// SetHeaders writes the signed-headers triple onto an http.Request.
func SetHeaders(r *http.Request, h SignedHeaders) {
	r.Header.Set("X-SDLC-Timestamp", h.Timestamp)
	r.Header.Set("X-SDLC-Nonce", h.Nonce)
	r.Header.Set("X-SDLC-Signature", h.Signature)
}

// HeadersFromRequest is the inverse — receiver pulls the triple off
// an inbound request.
func HeadersFromRequest(r *http.Request) SignedHeaders {
	return SignedHeaders{
		Timestamp: r.Header.Get("X-SDLC-Timestamp"),
		Nonce:     r.Header.Get("X-SDLC-Nonce"),
		Signature: r.Header.Get("X-SDLC-Signature"),
	}
}

// RetryDelays is the canonical 30s/2m/10m/1h/4h retry sequence.
func RetryDelays() []time.Duration {
	return []time.Duration{
		30 * time.Second,
		2 * time.Minute,
		10 * time.Minute,
		1 * time.Hour,
		4 * time.Hour,
	}
}
