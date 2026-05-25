package pipeline

import (
	"context"
	"fmt"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/panjf2000/ants/v2"
)

// PooledQueue uses ants goroutine pool instead of raw goroutines.
// Reduces GC pressure by reusing goroutines and limiting memory.
type PooledQueue struct {
	ch      chan ScreeningRequest
	pool    *ants.Pool
	depth   int
	workers int
}

// NewPooledQueue creates a queue backed by ants goroutine pool.
func NewPooledQueue(depth, workers int) (*PooledQueue, error) {
	if depth <= 0 {
		depth = DefaultQueueDepth
	}
	if workers <= 0 {
		workers = DefaultWorkers
	}
	pool, err := ants.NewPool(workers, ants.WithPreAlloc(true))
	if err != nil {
		return nil, fmt.Errorf("ants pool: %w", err)
	}
	return &PooledQueue{
		ch:      make(chan ScreeningRequest, depth),
		pool:    pool,
		depth:   depth,
		workers: workers,
	}, nil
}

// Enqueue adds a request. Returns error if queue is full.
func (q *PooledQueue) Enqueue(req ScreeningRequest) error {
	select {
	case q.ch <- req:
		return nil
	default:
		return fmt.Errorf("queue full (%d pending)", q.depth)
	}
}

// Process starts consuming from the queue using the ants pool.
func (q *PooledQueue) Process(ctx context.Context, engine ScreenFunc) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case req := <-q.ch:
				r := req // capture
				err := q.pool.Submit(func() {
					matches, err := engine(r.Name, r.TenantID, r.Lists)
					r.Callback <- Result{
						RequestID: r.ID,
						Matches:   matches,
						Err:       err,
					}
				})
				if err != nil {
					log.Printf("pool submit error: %v", err)
					r.Callback <- Result{
						RequestID: r.ID,
						Err:       fmt.Errorf("pool busy: %w", err),
					}
				}
			}
		}
	}()
}

// ScreenFunc is the screening function signature used by PooledQueue.
type ScreenFunc func(name string, tenantID domain.TenantID, lists []string) ([]domain.MatchResult, error)

// Depth returns current queue length.
func (q *PooledQueue) Depth() int { return len(q.ch) }

// Running returns goroutines currently executing tasks.
func (q *PooledQueue) Running() int { return q.pool.Running() }

// Free returns available goroutines in the pool.
func (q *PooledQueue) Free() int { return q.pool.Free() }

// Close releases the ants pool resources.
func (q *PooledQueue) Close() { q.pool.Release() }
