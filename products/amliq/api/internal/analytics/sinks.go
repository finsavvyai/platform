package analytics

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// NoopSink drops events. Used when no provider is configured and
// in tests that don't care about telemetry.
type NoopSink struct{}

// Emit satisfies Sink.
func (NoopSink) Emit(_ Event) {}

// LogSink writes events as structured JSON to stderr. Used in dev
// so a developer running `go run ./cmd/api/main.go` sees the
// funnel without needing PostHog credentials.
type LogSink struct{}

// Emit writes the event as one JSON line.
func (LogSink) Emit(ev Event) {
	if ev.Timestamp.IsZero() {
		ev.Timestamp = time.Now().UTC()
	}
	data, _ := json.Marshal(ev)
	log.Printf("analytics %s", string(data))
}

// HTTPSink POSTs events to a PostHog-compatible /capture/ endpoint.
// Calls run in the goroutine that invoked Emit; the caller is
// responsible for fanning out (the api/track.go helpers already do).
type HTTPSink struct {
	endpoint string
	apiKey   string
	client   *http.Client
	once     sync.Once
}

// NewHTTPSink wires an HTTPSink with the given /capture/ endpoint
// and project API key. A nil http.Client falls back to a 5-second
// default; safe to share across the binary.
func NewHTTPSink(endpoint, apiKey string, client *http.Client) *HTTPSink {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	return &HTTPSink{endpoint: endpoint, apiKey: apiKey, client: client}
}

// Emit serialises and POSTs the event. Errors log; they never bubble
// — analytics is a best-effort signal, not a control plane.
func (s *HTTPSink) Emit(ev Event) {
	if ev.Timestamp.IsZero() {
		ev.Timestamp = time.Now().UTC()
	}
	body := map[string]interface{}{
		"api_key":     s.apiKey,
		"event":       ev.Name,
		"distinct_id": ev.DistinctID,
		"timestamp":   ev.Timestamp.UTC().Format(time.RFC3339),
		"properties":  ev.Properties,
	}
	data, err := json.Marshal(body)
	if err != nil {
		log.Printf("analytics marshal: %v", err)
		return
	}
	req, err := http.NewRequest("POST", s.endpoint, bytes.NewReader(data))
	if err != nil {
		log.Printf("analytics request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		log.Printf("analytics post: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		log.Printf("analytics %s: HTTP %d", ev.Name, resp.StatusCode)
		return
	}
	s.once.Do(func() { log.Printf("analytics: HTTPSink active (endpoint=%s)", maskEndpoint(s.endpoint)) })
}

// maskEndpoint returns the host without query/path so logs don't
// leak the API key when the project encodes it in the path.
func maskEndpoint(u string) string {
	if u == "" {
		return ""
	}
	return fmt.Sprintf("%.40s…", u)
}
