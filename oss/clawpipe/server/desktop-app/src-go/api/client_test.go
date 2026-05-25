package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewClusterClient(t *testing.T) {
	c := NewClusterClient("myhost", 9000)
	if c.baseURL != "http://myhost:9000" {
		t.Errorf("baseURL = %q, want %q", c.baseURL, "http://myhost:9000")
	}
	if c.httpClient == nil {
		t.Fatal("httpClient is nil")
	}
}

func TestGetStatus_Success(t *testing.T) {
	status := ClusterStatus{
		ClusterID:   "test-cluster",
		TotalNodes:  3,
		OnlineNodes: 2,
		IsRunning:   true,
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cluster/status" {
			t.Errorf("path = %q, want /cluster/status", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	got, err := c.GetStatus(context.Background())
	if err != nil {
		t.Fatalf("GetStatus error: %v", err)
	}
	if got.ClusterID != "test-cluster" {
		t.Errorf("ClusterID = %q, want %q", got.ClusterID, "test-cluster")
	}
	if got.TotalNodes != 3 {
		t.Errorf("TotalNodes = %d, want 3", got.TotalNodes)
	}
}

func TestGetStatus_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	_, err := c.GetStatus(context.Background())
	if err == nil {
		t.Fatal("GetStatus expected error for 500, got nil")
	}
}

func TestGetStatus_ConnectionError(t *testing.T) {
	c := &ClusterClient{
		baseURL:    "http://127.0.0.1:1",
		httpClient: &http.Client{Timeout: 100 * time.Millisecond},
	}
	_, err := c.GetStatus(context.Background())
	if err == nil {
		t.Fatal("GetStatus expected connection error, got nil")
	}
}

func TestGetNodes_Success(t *testing.T) {
	nodes := []ClusterNode{
		{ID: "n1", Name: "Node1", Status: "online"},
		{ID: "n2", Name: "Node2", Status: "offline"},
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cluster/nodes" {
			t.Errorf("path = %q, want /cluster/nodes", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"nodes": nodes})
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	got, err := c.GetNodes(context.Background())
	if err != nil {
		t.Fatalf("GetNodes error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len(nodes) = %d, want 2", len(got))
	}
	if got[0].ID != "n1" {
		t.Errorf("nodes[0].ID = %q, want %q", got[0].ID, "n1")
	}
}

func TestGetNodes_Empty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"nodes": []ClusterNode{}})
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	got, err := c.GetNodes(context.Background())
	if err != nil {
		t.Fatalf("GetNodes error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("len(nodes) = %d, want 0", len(got))
	}
}

func TestGetNodes_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	_, err := c.GetNodes(context.Background())
	if err == nil {
		t.Fatal("GetNodes expected error for 500, got nil")
	}
}

func TestRegisterNode_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cluster/join" {
			t.Errorf("path = %q, want /cluster/join", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("method = %q, want POST", r.Method)
		}
		var reg NodeRegistration
		json.NewDecoder(r.Body).Decode(&reg)
		if reg.ID != "n1" {
			t.Errorf("reg.ID = %q, want %q", reg.ID, "n1")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	reg := &NodeRegistration{ID: "n1", Name: "Node1", Host: "localhost", Port: 8001}
	err := c.RegisterNode(context.Background(), reg)
	if err != nil {
		t.Fatalf("RegisterNode error: %v", err)
	}
}

func TestRegisterNode_Error(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	err := c.RegisterNode(context.Background(), &NodeRegistration{ID: "n1"})
	if err == nil {
		t.Fatal("RegisterNode expected error for 400, got nil")
	}
}
