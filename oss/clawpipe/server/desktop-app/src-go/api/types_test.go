package api

import (
	"encoding/json"
	"testing"
	"time"
)

func TestClusterStatus_JSONRoundTrip(t *testing.T) {
	original := ClusterStatus{
		ClusterID:   "test-cluster",
		MasterURL:   "http://localhost:8000",
		TotalNodes:  3,
		OnlineNodes: 2,
		TotalModels: 5,
		Timestamp:   "2026-01-01T00:00:00Z",
		IsRunning:   true,
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded ClusterStatus
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}

	if decoded.ClusterID != original.ClusterID {
		t.Errorf("ClusterID = %q, want %q", decoded.ClusterID, original.ClusterID)
	}
	if decoded.TotalNodes != original.TotalNodes {
		t.Errorf("TotalNodes = %d, want %d", decoded.TotalNodes, original.TotalNodes)
	}
	if decoded.IsRunning != original.IsRunning {
		t.Errorf("IsRunning = %v, want %v", decoded.IsRunning, original.IsRunning)
	}
}

func TestClusterNode_JSONRoundTrip(t *testing.T) {
	original := ClusterNode{
		ID:              "node-1",
		Name:            "Worker 1",
		Host:            "192.168.1.10",
		Port:            8001,
		Models:          []string{"gpt-4", "llama-3"},
		Status:          "online",
		Load:            42,
		MaxLoad:         100,
		LastHeartbeat:   time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		Capabilities:    map[string]string{"gpu": "true"},
		ResponseTime:    0.5,
		TotalRequests:   1000,
		SuccessRequests: 990,
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded ClusterNode
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}

	if decoded.ID != original.ID {
		t.Errorf("ID = %q, want %q", decoded.ID, original.ID)
	}
	if len(decoded.Models) != 2 {
		t.Errorf("len(Models) = %d, want 2", len(decoded.Models))
	}
	if decoded.Capabilities["gpu"] != "true" {
		t.Errorf("Capabilities[gpu] = %q, want %q", decoded.Capabilities["gpu"], "true")
	}
	if decoded.TotalRequests != 1000 {
		t.Errorf("TotalRequests = %d, want 1000", decoded.TotalRequests)
	}
}

func TestClusterNodeConfig_JSON(t *testing.T) {
	cfg := ClusterNodeConfig{
		Name:   "new-node",
		Host:   "10.0.0.1",
		Port:   8002,
		Models: []string{"llama-3"},
	}

	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded ClusterNodeConfig
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}

	if decoded.Name != "new-node" {
		t.Errorf("Name = %q, want %q", decoded.Name, "new-node")
	}
	if decoded.Port != 8002 {
		t.Errorf("Port = %d, want 8002", decoded.Port)
	}
}

func TestClusterMetrics_JSON(t *testing.T) {
	m := ClusterMetrics{
		TotalRequests:   5000,
		ActiveRequests:  10,
		AvgResponseTime: 0.25,
		SuccessRate:     99.5,
		Uptime:          86400,
		Throughput:      1.5,
	}

	data, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded ClusterMetrics
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}

	if decoded.TotalRequests != 5000 {
		t.Errorf("TotalRequests = %d, want 5000", decoded.TotalRequests)
	}
	if decoded.SuccessRate != 99.5 {
		t.Errorf("SuccessRate = %f, want 99.5", decoded.SuccessRate)
	}
}

func TestNodeCapabilities_JSON(t *testing.T) {
	nc := NodeCapabilities{
		GPU:    true,
		Memory: 16384,
		CPU:    8,
		OS:     "linux",
	}

	data, err := json.Marshal(nc)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded NodeCapabilities
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}

	if !decoded.GPU {
		t.Error("GPU = false, want true")
	}
	if decoded.Memory != 16384 {
		t.Errorf("Memory = %d, want 16384", decoded.Memory)
	}
	if decoded.OS != "linux" {
		t.Errorf("OS = %q, want %q", decoded.OS, "linux")
	}
}
