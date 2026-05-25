package pgx

import (
	"context"
	"database/sql"
	"fmt"
	"sync/atomic"
	"time"
)

// ReplicaPool manages a primary + read replica connection pool.
// Writes go to primary, reads round-robin across replicas.
type ReplicaPool struct {
	primary  *sql.DB
	replicas []*sql.DB
	next     atomic.Uint64 // round-robin counter
}

// ReplicaPoolConfig configures primary and replica connections.
type ReplicaPoolConfig struct {
	PrimaryURL  string
	ReplicaURLs []string
	PoolConfig  PoolConfig
}

// NewReplicaPool creates a pool with one primary and N read replicas.
func NewReplicaPool(cfg ReplicaPoolConfig) (*ReplicaPool, error) {
	primary, err := NewPoolFromConfig(cfg.PrimaryURL, cfg.PoolConfig)
	if err != nil {
		return nil, fmt.Errorf("primary: %w", err)
	}

	replicas := make([]*sql.DB, 0, len(cfg.ReplicaURLs))
	for _, url := range cfg.ReplicaURLs {
		replica, err := NewPoolFromConfig(url, cfg.PoolConfig)
		if err != nil {
			// Close already opened connections on error
			primary.Close()
			for _, r := range replicas {
				r.Close()
			}
			return nil, fmt.Errorf("replica %s: %w", url, err)
		}
		replicas = append(replicas, replica)
	}

	return &ReplicaPool{
		primary:  primary,
		replicas: replicas,
	}, nil
}

// Primary returns the write connection.
func (rp *ReplicaPool) Primary() *sql.DB {
	return rp.primary
}

// Read returns a read replica connection via round-robin.
// Falls back to primary if no replicas configured.
func (rp *ReplicaPool) Read() *sql.DB {
	if len(rp.replicas) == 0 {
		return rp.primary
	}
	idx := rp.next.Add(1) % uint64(len(rp.replicas))
	return rp.replicas[idx]
}

// Close closes all connections.
func (rp *ReplicaPool) Close() {
	rp.primary.Close()
	for _, r := range rp.replicas {
		r.Close()
	}
}

// HealthCheck verifies all connections are alive.
func (rp *ReplicaPool) HealthCheck() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rp.primary.PingContext(ctx); err != nil {
		return fmt.Errorf("primary unhealthy: %w", err)
	}
	for i, r := range rp.replicas {
		if err := r.PingContext(ctx); err != nil {
			return fmt.Errorf("replica %d unhealthy: %w", i, err)
		}
	}
	return nil
}

// ScaleConfig returns pool settings tuned for the architecture diagram:
// 100 PG connections per API node, auto-scale 2→10 nodes.
func ScaleConfig() PoolConfig {
	return PoolConfig{
		MaxConns:          100,
		MinConns:          20,
		MaxIdleTime:       15 * time.Second,
		MaxLifetime:       5 * time.Minute,
		HealthCheckPeriod: 10 * time.Second,
	}
}
