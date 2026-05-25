package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"finsavvyai-desktop/api"
	"finsavvyai-desktop/config"

	"github.com/sirupsen/logrus"
)

func apiNodeConfig(name, host string, port int, models []string) *api.ClusterNodeConfig {
	return &api.ClusterNodeConfig{Name: name, Host: host, Port: port, Models: models}
}

func TestGetClusterStatus_NonOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	got, err := svc.GetClusterStatus(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.IsRunning {
		t.Error("expected offline status for non-OK response")
	}
	if got.OnlineNodes != 0 {
		t.Errorf("OnlineNodes = %d, want 0", got.OnlineNodes)
	}
}

func TestGetClusterStatus_BadJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`not-json`))
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	_, err := svc.GetClusterStatus(context.Background())
	if err == nil {
		t.Fatal("expected error for bad JSON")
	}
}

func TestGetNodes_NonOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	got, err := svc.GetNodes(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should return local nodes (empty)
	if len(got) != 0 {
		t.Errorf("len(nodes) = %d, want 0", len(got))
	}
}

func TestGetNodes_BadJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{invalid`))
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	_, err := svc.GetNodes(context.Background())
	if err == nil {
		t.Fatal("expected error for bad JSON")
	}
}

func TestAddNode_NonOKStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	nodeID, err := svc.AddNode(context.Background(), apiNodeConfig("TestNode", "10.0.0.5", 8001, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if nodeID == "" {
		t.Error("nodeID should not be empty even with non-OK master response")
	}
}

func TestAddNode_WithModels(t *testing.T) {
	var receivedBody map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&receivedBody)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	nodeCfg := apiNodeConfig("GPU Node", "10.0.0.1", 8001, []string{"llama2", "gpt4"})
	nodeID, err := svc.AddNode(context.Background(), nodeCfg)
	if err != nil {
		t.Fatalf("AddNode error: %v", err)
	}
	if nodeID == "" {
		t.Error("nodeID should not be empty")
	}
	// Verify node is in cache with correct fields
	node, ok := svc.nodes[nodeID]
	if !ok {
		t.Fatal("node not in cache")
	}
	if node.Name != "GPU Node" {
		t.Errorf("Name = %q, want %q", node.Name, "GPU Node")
	}
	if len(node.Models) != 2 {
		t.Errorf("Models len = %d, want 2", len(node.Models))
	}
}

func TestRemoveNode_MasterUnavailable(t *testing.T) {
	cfg := &config.Config{
		Cluster: config.ClusterConfig{MasterHost: "127.0.0.1", MasterPort: 1, Timeout: 1},
	}
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)

	err := svc.RemoveNode(context.Background(), "nonexistent")
	if err != nil {
		t.Fatalf("RemoveNode should not fail when master is down: %v", err)
	}
}

func TestGetOfflineStatus_WithCachedNodes(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)

	svc.nodes["n1"] = nil
	svc.nodes["n2"] = nil

	status := svc.getOfflineStatus()
	if status.TotalNodes != 2 {
		t.Errorf("TotalNodes = %d, want 2", status.TotalNodes)
	}
	if status.IsRunning {
		t.Error("expected IsRunning = false")
	}
	if status.ClusterID != "finsavvy-home-cluster" {
		t.Errorf("ClusterID = %q", status.ClusterID)
	}
}
