package pgx

import (
	"context"
	"database/sql"
	"log"
	"sync/atomic"
	"time"
)

// ReplicaRouter routes reads to replicas and writes to the primary.
type ReplicaRouter struct {
	primary  *sql.DB
	replicas []*sql.DB
	counter  atomic.Uint64
}

// NewReplicaRouter creates a router with a primary database.
func NewReplicaRouter(primary *sql.DB) *ReplicaRouter {
	return &ReplicaRouter{primary: primary}
}

// WithReplicas adds read replicas from connection strings.
func (rr *ReplicaRouter) WithReplicas(urls []string) *ReplicaRouter {
	cfg := DefaultPoolConfig()
	for _, url := range urls {
		db, err := NewPoolFromConfig(url, cfg)
		if err != nil {
			log.Printf("replica %s: %v (skipped)", url[:min(len(url), 30)], err)
			continue
		}
		rr.replicas = append(rr.replicas, db)
		log.Printf("replica added: %s...(%d total)", url[:min(len(url), 30)], len(rr.replicas))
	}
	return rr
}

// Writer always returns the primary database for writes.
func (rr *ReplicaRouter) Writer() *sql.DB {
	return rr.primary
}

// Reader returns a read replica via round-robin, or primary if none available.
func (rr *ReplicaRouter) Reader() *sql.DB {
	healthy := rr.healthyReplicas()
	if len(healthy) == 0 {
		return rr.primary
	}
	idx := rr.counter.Add(1) % uint64(len(healthy))
	return healthy[idx]
}

// Close closes all replica connections (primary is managed externally).
func (rr *ReplicaRouter) Close() {
	for _, r := range rr.replicas {
		r.Close()
	}
}

// ReplicaCount returns the number of configured replicas.
func (rr *ReplicaRouter) ReplicaCount() int {
	return len(rr.replicas)
}

func (rr *ReplicaRouter) healthyReplicas() []*sql.DB {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	var healthy []*sql.DB
	for _, r := range rr.replicas {
		if err := r.PingContext(ctx); err == nil {
			healthy = append(healthy, r)
		}
	}
	return healthy
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
