package ingestion

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGLEIFClientLookupLEI(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"data": [{
				"id": "5493001KJTIIGC8K1R12",
				"attributes": {
					"entity": {
						"legalName": {
							"name": "Apple Inc"
						},
						"jurisdiction": "US",
						"category": "FUND"
					}
				}
			}]
		}`))
	}))
	defer server.Close()
	client := NewGLEIFClient(&http.Client{})
	client.baseURL = server.URL
	ctx := context.Background()
	record, err := client.LookupLEI(ctx, "Apple Inc")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if record.LEI != "5493001KJTIIGC8K1R12" {
		t.Errorf("LEI = %s, want 5493001KJTIIGC8K1R12", record.LEI)
	}
	if record.LegalName != "Apple Inc" {
		t.Errorf("LegalName = %s, want Apple Inc", record.LegalName)
	}
}

func TestGLEIFClientNoResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"data": []}`))
	}))
	defer server.Close()
	client := NewGLEIFClient(&http.Client{})
	client.baseURL = server.URL
	ctx := context.Background()
	_, err := client.LookupLEI(ctx, "Nonexistent Corp")
	if err == nil {
		t.Error("expected error for no results, got nil")
	}
}

func TestGLEIFClientServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()
	client := NewGLEIFClient(&http.Client{})
	client.baseURL = server.URL
	ctx := context.Background()
	_, err := client.LookupLEI(ctx, "Test Corp")
	if err == nil {
		t.Error("expected error for server error, got nil")
	}
}

func TestGLEIFParser(t *testing.T) {
	tests := []struct {
		name      string
		data      []byte
		wantCount int
		wantErr   bool
	}{
		{
			"valid data",
			[]byte(`{
				"data": [
					{"id": "5493001KJTIIGC8K1R12", "attributes": {"entity": {"legalName": {"name": "Apple Inc"}}}},
					{"id": "5493001KJTIIGC8K1R13", "attributes": {"entity": {"legalName": {"name": "Google LLC"}}}}
				]
			}`),
			2, false,
		},
		{"empty data", []byte(`{"data": []}`), 0, false},
		{"bad json", []byte(`{bad}`), 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewGLEIFParser()
			entities, err := p.Parse(tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("wantErr %v, got %v", tt.wantErr, err)
			}
			if len(entities) != tt.wantCount {
				t.Errorf("count = %d, want %d", len(entities), tt.wantCount)
			}
		})
	}
}
