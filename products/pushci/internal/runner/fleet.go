package runner

import (
	"fmt"
	"strings"
	"sync"
)

// FleetNode represents a Tailscale peer that can run CI jobs.
type FleetNode struct {
	Hostname     string
	IP           string
	Tags         []string
	Online       bool
	Capabilities []string
}

// RunnerReq describes what a CI job needs from a runner.
type RunnerReq struct {
	Tags         []string
	Capabilities []string
}

// Fleet manages discovered Tailscale peers.
type Fleet struct {
	nodes []FleetNode
	mu    sync.RWMutex
}

// Nodes returns a snapshot of the current fleet.
func (f *Fleet) Nodes() []FleetNode {
	f.mu.RLock()
	defer f.mu.RUnlock()
	out := make([]FleetNode, len(f.nodes))
	copy(out, f.nodes)
	return out
}

// SetNodes replaces the fleet node list (used after discovery).
func (f *Fleet) SetNodes(nodes []FleetNode) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.nodes = nodes
}

// FilterByTag returns only nodes that have the given ACL tag.
func FilterByTag(nodes []FleetNode, tag string) []FleetNode {
	var out []FleetNode
	for _, n := range nodes {
		for _, t := range n.Tags {
			if t == tag || strings.TrimPrefix(t, "tag:") == strings.TrimPrefix(tag, "tag:") {
				out = append(out, n)
				break
			}
		}
	}
	return out
}

// SelectRunner picks the first online node matching requirements.
func SelectRunner(nodes []FleetNode, req RunnerReq) (*FleetNode, error) {
	for _, n := range nodes {
		if !n.Online {
			continue
		}
		if !matchesTags(n, req.Tags) {
			continue
		}
		result := n
		return &result, nil
	}
	return nil, fmt.Errorf("no runner matches requirements (checked %d nodes)", len(nodes))
}

func matchesTags(n FleetNode, tags []string) bool {
	tagSet := make(map[string]bool, len(n.Tags))
	for _, t := range n.Tags {
		tagSet[t] = true
	}
	for _, t := range tags {
		if !tagSet[t] {
			return false
		}
	}
	return true
}
