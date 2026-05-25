package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"finsavvyai-desktop/api"
	"finsavvyai-desktop/config"

	"github.com/sirupsen/logrus"
)

func newTestClusterService(masterURL string) *ClusterService {
	parts := strings.SplitN(strings.TrimPrefix(masterURL, "http://"), ":", 2)
	host := parts[0]
	port := 0
	if len(parts) == 2 {
		for _, c := range parts[1] {
			if c >= '0' && c <= '9' {
				port = port*10 + int(c-'0')
			}
		}
	}
	cfg := &config.Config{
		Cluster: config.ClusterConfig{MasterHost: host, MasterPort: port, Timeout: 5},
	}
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	return NewClusterService(cfg, logger)
}

func TestNewClusterService(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	svc := NewClusterService(cfg, logger)
	if svc == nil {
		t.Fatal("NewClusterService returned nil")
	}
	if svc.config != cfg {
		t.Error("config not set correctly")
	}
	if svc.nodes == nil {
		t.Error("nodes map is nil")
	}
}

func TestGetClusterStatus_Online(t *testing.T) {
	status := api.ClusterStatus{
		ClusterID: "prod-cluster", TotalNodes: 5, OnlineNodes: 4, IsRunning: true,
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status)
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	got, err := svc.GetClusterStatus(context.Background())
	if err != nil {
		t.Fatalf("GetClusterStatus error: %v", err)
	}
	if got.ClusterID != "prod-cluster" {
		t.Errorf("ClusterID = %q, want %q", got.ClusterID, "prod-cluster")
	}
	if got.TotalNodes != 5 {
		t.Errorf("TotalNodes = %d, want 5", got.TotalNodes)
	}
}

func TestGetClusterStatus_Offline(t *testing.T) {
	cfg := &config.Config{
		Cluster: config.ClusterConfig{MasterHost: "127.0.0.1", MasterPort: 1, Timeout: 1},
	}
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)

	got, err := svc.GetClusterStatus(context.Background())
	if err != nil {
		t.Fatalf("GetClusterStatus error: %v", err)
	}
	if got.IsRunning != false {
		t.Error("IsRunning = true, want false for offline")
	}
	if got.OnlineNodes != 0 {
		t.Errorf("OnlineNodes = %d, want 0", got.OnlineNodes)
	}
}

func TestGetNodes_FromMaster(t *testing.T) {
	nodes := []*api.ClusterNode{
		{ID: "n1", Name: "Node1", Status: "online"},
		{ID: "n2", Name: "Node2", Status: "offline"},
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"nodes": nodes})
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	got, err := svc.GetNodes(context.Background())
	if err != nil {
		t.Fatalf("GetNodes error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len(nodes) = %d, want 2", len(got))
	}
}

func TestGetNodes_Cached(t *testing.T) {
	cfg := &config.Config{
		Cluster: config.ClusterConfig{MasterHost: "127.0.0.1", MasterPort: 1, Timeout: 1},
	}
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)
	svc.nodes["cached-1"] = &api.ClusterNode{ID: "cached-1", Name: "Cached"}

	got, err := svc.GetNodes(context.Background())
	if err != nil {
		t.Fatalf("GetNodes error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("len(nodes) = %d, want 1", len(got))
	}
	if got[0].ID != "cached-1" {
		t.Errorf("ID = %q, want %q", got[0].ID, "cached-1")
	}
}

func TestAddNode_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	cfg := &api.ClusterNodeConfig{Name: "NewNode", Host: "10.0.0.1", Port: 8001}
	nodeID, err := svc.AddNode(context.Background(), cfg)
	if err != nil {
		t.Fatalf("AddNode error: %v", err)
	}
	if nodeID == "" {
		t.Error("AddNode returned empty nodeID")
	}
	if _, ok := svc.nodes[nodeID]; !ok {
		t.Error("Node not found in local cache")
	}
}

func TestAddNode_MasterUnavailable(t *testing.T) {
	cfg := &config.Config{
		Cluster: config.ClusterConfig{MasterHost: "127.0.0.1", MasterPort: 1, Timeout: 1},
	}
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewClusterService(cfg, logger)

	nodeCfg := &api.ClusterNodeConfig{Name: "N", Host: "h", Port: 1}
	nodeID, err := svc.AddNode(context.Background(), nodeCfg)
	if err != nil {
		t.Fatalf("AddNode error: %v", err)
	}
	if nodeID == "" {
		t.Error("nodeID should not be empty even when master is down")
	}
}

func TestRemoveNode_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	svc := newTestClusterService(srv.URL)
	svc.nodes["rm-1"] = &api.ClusterNode{ID: "rm-1"}
	err := svc.RemoveNode(context.Background(), "rm-1")
	if err != nil {
		t.Fatalf("RemoveNode error: %v", err)
	}
	if _, ok := svc.nodes["rm-1"]; ok {
		t.Error("Node still in cache after removal")
	}
}
