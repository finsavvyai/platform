package scaling

import (
	"fmt"

	"github.com/buraksezer/consistent"
	"github.com/cespare/xxhash/v2"
)

// ScreeningHasher distributes screening requests across API nodes
// using consistent hashing with virtual nodes. When a node is added/removed,
// only 1/N of keys are rehashed (minimal disruption).
type ScreeningHasher struct {
	ring    *consistent.Consistent
	members map[string]Member
}

// Member represents an API node in the screening cluster.
type Member struct {
	Name string
	Addr string
}

// String implements consistent.Member.
func (m Member) String() string { return m.Name }

// xxHasher implements consistent.Hasher using xxhash (fast, non-crypto).
type xxHasher struct{}

func (h xxHasher) Sum64(data []byte) uint64 {
	return xxhash.Sum64(data)
}

// HasherConfig configures the consistent hashing ring.
type HasherConfig struct {
	PartitionCount    int // Number of virtual nodes per member (default 271)
	ReplicationFactor int // Number of replicas per key (default 20)
	Load              float64 // Max load factor per member (default 1.25)
}

// DefaultHasherConfig returns config for 2-10 API node scaling.
func DefaultHasherConfig() HasherConfig {
	return HasherConfig{
		PartitionCount:    271,
		ReplicationFactor: 20,
		Load:              1.25,
	}
}

// NewScreeningHasher creates a consistent hashing ring.
func NewScreeningHasher(cfg HasherConfig) *ScreeningHasher {
	if cfg.PartitionCount <= 0 {
		cfg.PartitionCount = 271
	}
	if cfg.ReplicationFactor <= 0 {
		cfg.ReplicationFactor = 20
	}
	if cfg.Load <= 0 {
		cfg.Load = 1.25
	}

	ring := consistent.New(nil, consistent.Config{
		PartitionCount:    cfg.PartitionCount,
		ReplicationFactor: cfg.ReplicationFactor,
		Load:              cfg.Load,
		Hasher:            xxHasher{},
	})

	return &ScreeningHasher{
		ring:    ring,
		members: make(map[string]Member),
	}
}

// AddNode registers an API node in the ring.
func (h *ScreeningHasher) AddNode(name, addr string) {
	m := Member{Name: name, Addr: addr}
	h.ring.Add(m)
	h.members[name] = m
}

// RemoveNode removes an API node. Only ~1/N keys rehash.
func (h *ScreeningHasher) RemoveNode(name string) {
	if m, ok := h.members[name]; ok {
		h.ring.Remove(m.String())
		delete(h.members, name)
	}
}

// GetNode returns which API node should handle a given name screening.
func (h *ScreeningHasher) GetNode(entityName string) (Member, error) {
	m := h.ring.LocateKey([]byte(entityName))
	if m == nil {
		return Member{}, fmt.Errorf("no nodes available")
	}
	member, ok := h.members[m.String()]
	if !ok {
		return Member{}, fmt.Errorf("node %s not found", m.String())
	}
	return member, nil
}

// GetNodes returns N closest nodes for a key (for replication/fallback).
func (h *ScreeningHasher) GetNodes(entityName string, count int) ([]Member, error) {
	closest, err := h.ring.GetClosestN([]byte(entityName), count)
	if err != nil {
		return nil, err
	}
	members := make([]Member, 0, len(closest))
	for _, m := range closest {
		if member, ok := h.members[m.String()]; ok {
			members = append(members, member)
		}
	}
	return members, nil
}

// NodeCount returns the number of registered nodes.
func (h *ScreeningHasher) NodeCount() int { return len(h.members) }

// Distribution returns how many partitions each node owns.
func (h *ScreeningHasher) Distribution() map[string]int {
	dist := make(map[string]int)
	for name := range h.members {
		dist[name] = 0
	}
	// Sample 10K random keys to estimate distribution
	for i := 0; i < 10000; i++ {
		key := fmt.Sprintf("sample_%d", i)
		m := h.ring.LocateKey([]byte(key))
		if m != nil {
			dist[m.String()]++
		}
	}
	return dist
}
