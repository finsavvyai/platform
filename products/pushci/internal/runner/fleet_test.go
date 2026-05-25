package runner

import (
	"testing"
)

const mockTailscaleStatus = `{"Peer":{
"abc123":{"HostName":"runner-1","TailscaleIPs":["100.64.1.1"],"Tags":["tag:pushci-runner"],"Online":true},
"def456":{"HostName":"runner-2","TailscaleIPs":["100.64.1.2"],"Tags":["tag:pushci-runner","tag:gpu"],"Online":true},
"ghi789":{"HostName":"desktop-3","TailscaleIPs":["100.64.1.3"],"Tags":[],"Online":false}}}`

func TestParsePeers(t *testing.T) {
	nodes, err := parsePeers([]byte(mockTailscaleStatus))
	if err != nil {
		t.Fatalf("parsePeers error: %v", err)
	}
	if len(nodes) != 3 {
		t.Fatalf("got %d nodes, want 3", len(nodes))
	}
	found := map[string]bool{}
	for _, n := range nodes {
		found[n.Hostname] = true
		if n.IP == "" {
			t.Errorf("node %s has empty IP", n.Hostname)
		}
	}
	for _, name := range []string{"runner-1", "runner-2", "desktop-3"} {
		if !found[name] {
			t.Errorf("missing node %q", name)
		}
	}
}

func TestFilterByTag(t *testing.T) {
	nodes, _ := parsePeers([]byte(mockTailscaleStatus))

	runners := FilterByTag(nodes, "tag:pushci-runner")
	if len(runners) != 2 {
		t.Errorf("got %d runners, want 2", len(runners))
	}

	gpuNodes := FilterByTag(nodes, "tag:gpu")
	if len(gpuNodes) != 1 {
		t.Errorf("got %d gpu nodes, want 1", len(gpuNodes))
	}

	empty := FilterByTag(nodes, "tag:nonexistent")
	if len(empty) != 0 {
		t.Errorf("got %d nodes for missing tag, want 0", len(empty))
	}
}

func TestSelectRunner(t *testing.T) {
	nodes, _ := parsePeers([]byte(mockTailscaleStatus))

	t.Run("finds online runner", func(t *testing.T) {
		r, err := SelectRunner(nodes, RunnerReq{Tags: []string{"tag:pushci-runner"}})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if r == nil {
			t.Fatal("expected runner, got nil")
		}
		if !r.Online {
			t.Error("selected runner is offline")
		}
	})

	t.Run("no match for offline only", func(t *testing.T) {
		offline := []FleetNode{{Hostname: "x", Online: false, Tags: []string{"tag:pushci-runner"}}}
		_, err := SelectRunner(offline, RunnerReq{Tags: []string{"tag:pushci-runner"}})
		if err == nil {
			t.Error("expected error for no online runners")
		}
	})

	t.Run("no match for wrong tag", func(t *testing.T) {
		_, err := SelectRunner(nodes, RunnerReq{Tags: []string{"tag:special"}})
		if err == nil {
			t.Error("expected error for unmatched tag")
		}
	})
}

func TestFleetNodeSnapshot(t *testing.T) {
	f := &Fleet{}
	nodes := []FleetNode{{Hostname: "a", Online: true}, {Hostname: "b", Online: false}}
	f.SetNodes(nodes)
	got := f.Nodes()
	if len(got) != 2 {
		t.Fatalf("got %d nodes, want 2", len(got))
	}
	// Verify it's a copy
	got[0].Hostname = "mutated"
	if f.Nodes()[0].Hostname == "mutated" {
		t.Error("Nodes() should return a copy, not a reference")
	}
}
