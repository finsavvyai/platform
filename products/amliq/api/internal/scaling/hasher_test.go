package scaling

import (
	"fmt"
	"testing"
)

func TestScreeningHasher_AddAndRoute(t *testing.T) {
	h := NewScreeningHasher(DefaultHasherConfig())
	h.AddNode("node-1", "10.0.0.1:8080")
	h.AddNode("node-2", "10.0.0.2:8080")
	h.AddNode("node-3", "10.0.0.3:8080")

	if h.NodeCount() != 3 {
		t.Fatalf("expected 3 nodes, got %d", h.NodeCount())
	}

	m, err := h.GetNode("vladimir putin")
	if err != nil {
		t.Fatalf("get node: %v", err)
	}
	if m.Name == "" {
		t.Fatal("expected non-empty node name")
	}
}

func TestScreeningHasher_Consistency(t *testing.T) {
	h := NewScreeningHasher(DefaultHasherConfig())
	h.AddNode("node-1", "10.0.0.1:8080")
	h.AddNode("node-2", "10.0.0.2:8080")

	// Same key should always route to same node
	m1, _ := h.GetNode("test-name")
	m2, _ := h.GetNode("test-name")
	if m1.Name != m2.Name {
		t.Errorf("inconsistent routing: %s vs %s", m1.Name, m2.Name)
	}
}

func TestScreeningHasher_Distribution(t *testing.T) {
	h := NewScreeningHasher(DefaultHasherConfig())
	h.AddNode("node-1", "10.0.0.1:8080")
	h.AddNode("node-2", "10.0.0.2:8080")
	h.AddNode("node-3", "10.0.0.3:8080")

	dist := h.Distribution()
	for name, count := range dist {
		// Each node should get roughly 33% of 10K samples
		if count < 2000 || count > 5000 {
			t.Errorf("node %s has uneven distribution: %d/10000", name, count)
		}
	}
}

func TestScreeningHasher_RemoveMinimalRehash(t *testing.T) {
	h := NewScreeningHasher(DefaultHasherConfig())
	h.AddNode("node-1", "10.0.0.1:8080")
	h.AddNode("node-2", "10.0.0.2:8080")
	h.AddNode("node-3", "10.0.0.3:8080")

	// Record routing for 1000 keys
	before := make(map[string]string, 1000)
	for i := 0; i < 1000; i++ {
		key := fmt.Sprintf("name_%d", i)
		m, _ := h.GetNode(key)
		before[key] = m.Name
	}

	// Remove one node
	h.RemoveNode("node-2")

	// Count how many keys changed routing
	changed := 0
	for i := 0; i < 1000; i++ {
		key := fmt.Sprintf("name_%d", i)
		m, _ := h.GetNode(key)
		if m.Name != before[key] {
			changed++
		}
	}

	// Only ~1/3 of keys should rehash (the ones that were on node-2)
	if changed > 500 {
		t.Errorf("too many keys rehashed: %d/1000 (expected ~333)", changed)
	}
}
