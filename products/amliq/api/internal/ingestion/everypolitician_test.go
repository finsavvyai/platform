package ingestion

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestEveryPoliticianClientFetch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/countries/DE/legislators" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[{"name":"Angela Merkel","country":"DE","party":"CDU","position":"Chancellor","start_date":"2005-11-22","end_date":"2021-12-08","source":"wikidata"},{"name":"Olaf Scholz","country":"DE","party":"SPD","position":"Chancellor","start_date":"2021-12-08","end_date":"","source":"wikidata"}]`))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := NewEveryPoliticianClient(server.URL, server.Client())
	records, err := client.FetchPoliticians("DE")
	if err != nil {
		t.Fatalf("fetch error: %v", err)
	}

	tests := []struct {
		name  string
		check func() bool
	}{
		{"count", func() bool { return len(records) == 2 }},
		{"merkel_name", func() bool { return records[0].Name == "Angela Merkel" }},
		{"merkel_end", func() bool { return records[0].EndDate == "2021-12-08" }},
		{"scholz_active", func() bool { return records[1].EndDate == "" }},
		{"scholz_party", func() bool { return records[1].Party == "SPD" }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error("check failed")
			}
		})
	}
}

func TestEveryPoliticianClientEmpty(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`[]`))
	}))
	defer server.Close()

	client := NewEveryPoliticianClient(server.URL, server.Client())
	records, err := client.FetchPoliticians("XX")
	if err != nil {
		t.Fatalf("fetch error: %v", err)
	}

	if len(records) != 0 {
		t.Errorf("expected 0 records, got %d", len(records))
	}
}

func TestEveryPoliticianClientError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewEveryPoliticianClient(server.URL, server.Client())
	_, err := client.FetchPoliticians("DE")
	if err == nil {
		t.Error("expected error for 500 status")
	}
}

func TestMapToPEPProfile(t *testing.T) {
	tests := []struct {
		name          string
		position      string
		expectedTier  domain.PEPTier
	}{
		{"president", "President of Germany", domain.PEPTier1},
		{"minister", "Foreign Minister", domain.PEPTier2},
		{"mayor", "Mayor of Berlin", domain.PEPTier3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := &PoliticianRecord{Name: "Test", Country: "DE", Position: tt.position, EndDate: ""}
			profile := rec.MapToPEPProfile("test-id")
			if profile.Tier != tt.expectedTier {
				t.Errorf("expected tier %v, got %v", tt.expectedTier, profile.Tier)
			}
		})
	}
}
