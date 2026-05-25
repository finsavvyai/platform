package api

import (
	"encoding/json"
	"testing"
)

func TestClusterStatus_ZeroValue(t *testing.T) {
	var s ClusterStatus
	data, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("Marshal zero value error: %v", err)
	}

	var decoded ClusterStatus
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal zero value error: %v", err)
	}
	if decoded.IsRunning != false {
		t.Error("zero value IsRunning should be false")
	}
	if decoded.TotalNodes != 0 {
		t.Errorf("zero value TotalNodes = %d, want 0", decoded.TotalNodes)
	}
}

func TestClusterNode_NilSlicesAndMaps(t *testing.T) {
	node := ClusterNode{ID: "n1"}
	data, err := json.Marshal(node)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded ClusterNode
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if decoded.ID != "n1" {
		t.Errorf("ID = %q, want %q", decoded.ID, "n1")
	}
}

func TestClusterStatus_JSONFieldTags(t *testing.T) {
	jsonStr := `{"cluster_id":"c1","master":"http://x","total_nodes":1,"online_nodes":1,"total_models":2,"timestamp":"t","is_running":true}`
	var s ClusterStatus
	if err := json.Unmarshal([]byte(jsonStr), &s); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if s.ClusterID != "c1" {
		t.Errorf("ClusterID = %q, want %q", s.ClusterID, "c1")
	}
	if s.MasterURL != "http://x" {
		t.Errorf("MasterURL = %q, want %q", s.MasterURL, "http://x")
	}
}

func TestClusterMetrics_ZeroValue(t *testing.T) {
	var m ClusterMetrics
	data, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded ClusterMetrics
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if decoded.Throughput != 0 {
		t.Errorf("Throughput = %f, want 0", decoded.Throughput)
	}
}

func TestNodeCapabilities_ZeroValue(t *testing.T) {
	var nc NodeCapabilities
	data, err := json.Marshal(nc)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded NodeCapabilities
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if decoded.GPU != false {
		t.Error("GPU zero value should be false")
	}
	if decoded.CPU != 0 {
		t.Errorf("CPU = %d, want 0", decoded.CPU)
	}
}
