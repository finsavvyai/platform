package ingestion

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPremiumClientFetchEnriched(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.URL.Path == "/v2/entities/entity-123/premium" {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-RateLimit-Remaining", "99")
			w.Header().Set("X-RateLimit-Reset", time.Now().Add(time.Hour).Format(time.RFC3339))
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{
				"entity_id":"entity-123",
				"name":"Vladimir Putin",
				"sanctions":["OFAC-SDN","EU-Consolidated"],
				"associations":["company-456","person-789"],
				"sanctions_programs":["General Licenses","OFACs"],
				"media_mentions":2541,
				"risk_score":0.98,
				"confidence_level":0.95,
				"last_modified":"2024-01-15T10:30:00Z"
			}`))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := NewPremiumClient(server.URL, "test-key", server.Client())
	record, err := client.FetchEnriched("entity-123")
	if err != nil {
		t.Fatalf("fetch error: %v", err)
	}

	tests := []struct {
		name  string
		check func() bool
	}{
		{"entity_id", func() bool { return record.EntityID == "entity-123" }},
		{"name", func() bool { return record.Name == "Vladimir Putin" }},
		{"sanctions_count", func() bool { return len(record.Sanctions) == 2 }},
		{"assoc_count", func() bool { return len(record.Associations) == 2 }},
		{"risk_score", func() bool { return record.RiskScore == 0.98 }},
		{"media_mentions", func() bool { return record.MediaMentions == 2541 }},
		{"rate_limit", func() bool { return client.RateLimit.Remaining == 99 }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error("check failed")
			}
		})
	}
}

func TestPremiumClientErrors(t *testing.T) {
	tests := []struct {
		name     string
		status   int
		apiKey   string
		expected string
	}{
		{"unauthorized", http.StatusUnauthorized, "key", "invalid api key"},
		{"not_found", http.StatusNotFound, "test", "entity not found"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.status)
			}))
			defer s.Close()
			c := NewPremiumClient(s.URL, tt.apiKey, s.Client())
			_, err := c.FetchEnriched("id")
			if err == nil || err.Error() != tt.expected {
				t.Errorf("expected '%s', got: %v", tt.expected, err)
			}
		})
	}
}

func TestPremiumClientNoAPIKey(t *testing.T) {
	client := NewPremiumClient("https://api.example.com", "", nil)
	_, err := client.FetchEnriched("entity-123")
	if err == nil || err.Error() != "api key required" {
		t.Errorf("expected 'api key required' error, got: %v", err)
	}
}

func TestPremiumClientRateLimit(t *testing.T) {
	tests := []struct {
		name        string
		remaining   int
		resetOffset time.Duration
		expected    bool
	}{
		{"limited", 5, 30 * time.Minute, true},
		{"reset_passed", 5, -1 * time.Minute, false},
		{"not_limited", 100, 1 * time.Hour, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := NewPremiumClient("https://api.example.com", "test-key", nil)
			c.RateLimit.Remaining = tt.remaining
			c.RateLimit.Reset = time.Now().Add(tt.resetOffset)
			if c.RateLimited() != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, c.RateLimited())
			}
		})
	}
}
