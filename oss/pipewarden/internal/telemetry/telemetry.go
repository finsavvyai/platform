// Package telemetry emits anonymous, opt-in usage events to PostHog.
//
// Defaults are off — nothing is sent unless the user sets
// PIPEWARDEN_TELEMETRY=on (or "1", "true"). The advertised promise on
// the trust page is "no phone home by default" and this package
// enforces that with a single Enabled() check at the boundary.
package telemetry

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	// DefaultEndpoint is PostHog cloud's capture URL. Self-hosters can
	// override via PIPEWARDEN_TELEMETRY_HOST so events never leave their
	// network.
	DefaultEndpoint = "https://us.i.posthog.com/capture/"

	// FallbackAPIKey is a placeholder. Real deploys override with
	// PIPEWARDEN_TELEMETRY_KEY at build/install time so different
	// distributions can be analyzed separately.
	FallbackAPIKey = "phc_placeholder"
)

// Enabled reports whether telemetry should fire for this process.
// Opt-in only: env var must be one of "1", "on", "true",
// "yes" (case-insensitive). Anything else, including unset, is off.
func Enabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("PIPEWARDEN_TELEMETRY"))) {
	case "1", "on", "true", "yes":
		return true
	}
	return false
}

// Sender posts events. Construct once at startup and reuse; safe for
// concurrent calls.
type Sender struct {
	endpoint string
	apiKey   string
	hostname string
	http     *http.Client

	once   sync.Once
	distID string // sha256 of hostname; stable per machine, never PII
}

// New builds a Sender with sensible defaults. Reads
// PIPEWARDEN_TELEMETRY_HOST / PIPEWARDEN_TELEMETRY_KEY if set.
func New() *Sender {
	endpoint := strings.TrimSpace(os.Getenv("PIPEWARDEN_TELEMETRY_HOST"))
	if endpoint == "" {
		endpoint = DefaultEndpoint
	}
	apiKey := strings.TrimSpace(os.Getenv("PIPEWARDEN_TELEMETRY_KEY"))
	if apiKey == "" {
		apiKey = FallbackAPIKey
	}
	host, _ := os.Hostname()
	return &Sender{
		endpoint: endpoint,
		apiKey:   apiKey,
		hostname: host,
		http:     &http.Client{Timeout: 5 * time.Second},
	}
}

// distinctID returns a stable anonymous ID derived from hostname.
// Hash so the value posted is never PII; deterministic so we can
// count unique installs without storing identifying data.
func (s *Sender) distinctID() string {
	s.once.Do(func() {
		h := sha256.Sum256([]byte(s.hostname))
		s.distID = hex.EncodeToString(h[:])[:16]
	})
	return s.distID
}

// Event is one captured action.
type Event struct {
	Name       string         // e.g. "scan_run", "install_completed"
	Properties map[string]any // free-form attributes
}

// Send fires the event when telemetry is enabled. Returns nil
// (success) when disabled — callers do not need to gate the call site.
// Errors are returned for logging but never block the user flow.
func (s *Sender) Send(ctx context.Context, ev Event) error {
	if !Enabled() {
		return nil
	}
	props := map[string]any{
		"os":        runtime.GOOS,
		"arch":      runtime.GOARCH,
		"go_ver":    runtime.Version(),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	for k, v := range ev.Properties {
		props[k] = v
	}
	payload := map[string]any{
		"api_key":     s.apiKey,
		"event":       ev.Name,
		"distinct_id": s.distinctID(),
		"properties":  props,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("telemetry: marshal: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("telemetry: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.http.Do(req)
	if err != nil {
		return fmt.Errorf("telemetry: send: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("telemetry: status %d", resp.StatusCode)
	}
	return nil
}
