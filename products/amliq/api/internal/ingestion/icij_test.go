package ingestion

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestICIJClientSearch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/search/entities" && r.URL.Query().Get("q") == "Acme" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"results":[
				{"name":"Acme Corp","jurisdiction_description":"Delaware, United States","countries":["US"],"source_id":"p1","linked_to":["contact1"],"data_source":"Panama Papers"},
				{"name":"Acme Consulting","jurisdiction_description":"British Virgin Islands","countries":["VG"],"source_id":"p2","linked_to":[],"data_source":"Paradise Papers"}
			]}`))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := NewICIJClient(server.URL, server.Client())
	records, err := client.SearchEntities("Acme")
	if err != nil {
		t.Fatalf("search error: %v", err)
	}

	tests := []struct {
		name  string
		check func() bool
	}{
		{"count", func() bool { return len(records) == 2 }},
		{"name_0", func() bool { return records[0].Name == "Acme Corp" }},
		{"source_0", func() bool { return records[0].DataSource == "Panama Papers" }},
		{"countries_0", func() bool { return len(records[0].Countries) == 1 && records[0].Countries[0] == "US" }},
		{"name_1", func() bool { return records[1].Name == "Acme Consulting" }},
		{"linked_0", func() bool { return len(records[0].LinkedTo) == 1 }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error("check failed")
			}
		})
	}
}

func TestICIJClientGetEntity(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/entities/p1" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"name":"Acme Corp","jurisdiction_description":"Delaware","countries":["US"],"source_id":"p1","linked_to":["contact1","contact2"],"data_source":"Panama Papers"}`))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := NewICIJClient(server.URL, server.Client())
	record, err := client.GetEntity("p1")
	if err != nil {
		t.Fatalf("fetch error: %v", err)
	}

	tests := []struct {
		name  string
		check func() bool
	}{
		{"name", func() bool { return record.Name == "Acme Corp" }},
		{"jurisdiction", func() bool { return record.JurisdictionDescription == "Delaware" }},
		{"linked_count", func() bool { return len(record.LinkedTo) == 2 }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error("check failed")
			}
		})
	}
}

func TestICIJClientEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		status   int
		body     string
		expected int
		shouldErr bool
	}{
		{"error", 500, "", 0, true},
		{"empty", 200, `{"results":[]}`, 0, false},
		{"array", 200, `[{"name":"E1","source_id":"id1","data_source":"Pandora Papers"}]`, 1, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.status)
				if tt.body != "" {
					w.Write([]byte(tt.body))
				}
			}))
			defer s.Close()
			c := NewICIJClient(s.URL, s.Client())
			records, err := c.SearchEntities("q")
			if (err != nil) != tt.shouldErr {
				t.Errorf("error mismatch: got %v", err)
			}
			if len(records) != tt.expected {
				t.Errorf("expected %d records, got %d", tt.expected, len(records))
			}
		})
	}
}
