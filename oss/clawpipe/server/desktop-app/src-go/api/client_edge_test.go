package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGetStatus_MalformedJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("{bad json"))
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	_, err := c.GetStatus(context.Background())
	if err == nil {
		t.Fatal("GetStatus expected error for malformed JSON, got nil")
	}
}

func TestGetNodes_MalformedJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("not json"))
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	_, err := c.GetNodes(context.Background())
	if err == nil {
		t.Fatal("GetNodes expected error for malformed JSON, got nil")
	}
}

func TestGetNodes_ConnectionError(t *testing.T) {
	c := &ClusterClient{
		baseURL:    "http://127.0.0.1:1",
		httpClient: &http.Client{Timeout: 100 * time.Millisecond},
	}
	_, err := c.GetNodes(context.Background())
	if err == nil {
		t.Fatal("GetNodes expected connection error, got nil")
	}
}

func TestRegisterNode_ConnectionError(t *testing.T) {
	c := &ClusterClient{
		baseURL:    "http://127.0.0.1:1",
		httpClient: &http.Client{Timeout: 100 * time.Millisecond},
	}
	err := c.RegisterNode(context.Background(), &NodeRegistration{ID: "x"})
	if err == nil {
		t.Fatal("RegisterNode expected connection error, got nil")
	}
}

func TestSendCompletion_ConnectionError(t *testing.T) {
	c := &ClusterClient{
		baseURL:    "http://127.0.0.1:1",
		httpClient: &http.Client{Timeout: 100 * time.Millisecond},
	}
	req := &CompletionRequest{
		Model:    "gpt-4",
		Messages: []Message{{Role: "user", Content: "Hi"}},
	}
	_, err := c.SendCompletion(context.Background(), req)
	if err == nil {
		t.Fatal("SendCompletion expected connection error, got nil")
	}
}

func TestSendCompletion_MalformedJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("{bad"))
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	req := &CompletionRequest{
		Model:    "gpt-4",
		Messages: []Message{{Role: "user", Content: "Hi"}},
	}
	_, err := c.SendCompletion(context.Background(), req)
	if err == nil {
		t.Fatal("SendCompletion expected decode error, got nil")
	}
}

func TestRegisterNode_FullPayload(t *testing.T) {
	var received NodeRegistration
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&received)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	reg := &NodeRegistration{
		ID:           "n1",
		Name:         "Worker",
		Host:         "10.0.0.1",
		Port:         8001,
		Models:       []string{"gpt-4", "llama"},
		Capabilities: map[string]string{"gpu": "true"},
		MaxLoad:      100,
	}
	if err := c.RegisterNode(context.Background(), reg); err != nil {
		t.Fatalf("RegisterNode error: %v", err)
	}
	if received.MaxLoad != 100 {
		t.Errorf("MaxLoad = %d, want 100", received.MaxLoad)
	}
	if len(received.Models) != 2 {
		t.Errorf("len(Models) = %d, want 2", len(received.Models))
	}
}

func TestSendHeartbeat_VerifiesPayload(t *testing.T) {
	var received Heartbeat
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&received)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	hb := &Heartbeat{ID: "n1", Status: "busy", Load: 75}
	if err := c.SendHeartbeat(context.Background(), "n1", hb); err != nil {
		t.Fatalf("SendHeartbeat error: %v", err)
	}
	if received.Status != "busy" {
		t.Errorf("Status = %q, want %q", received.Status, "busy")
	}
	if received.Load != 75 {
		t.Errorf("Load = %d, want 75", received.Load)
	}
}

func TestGetStatus_HTTPStatuses(t *testing.T) {
	tests := []struct {
		name   string
		status int
	}{
		{"bad_request", http.StatusBadRequest},
		{"forbidden", http.StatusForbidden},
		{"not_found", http.StatusNotFound},
		{"service_unavailable", http.StatusServiceUnavailable},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.status)
			}))
			defer srv.Close()

			c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
			_, err := c.GetStatus(context.Background())
			if err == nil {
				t.Errorf("GetStatus expected error for %d, got nil", tt.status)
			}
		})
	}
}

func TestNewClusterClient_Timeout(t *testing.T) {
	c := NewClusterClient("example.com", 443)
	if c.httpClient.Timeout != 30*time.Second {
		t.Errorf("Timeout = %v, want 30s", c.httpClient.Timeout)
	}
}
