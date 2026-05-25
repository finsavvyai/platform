package pipeline

import (
	"context"
	"fmt"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
)

// DefaultWorkers is the default number of screening goroutines.
const DefaultWorkers = 100

// DefaultQueueDepth is the maximum pending screening requests.
const DefaultQueueDepth = 10000

// ScreeningRequest is a queued screening job.
type ScreeningRequest struct {
	ID       string
	Name     string
	TenantID domain.TenantID
	Lists    []string
	Callback chan Result
}

// Result is the outcome of an async screening.
type Result struct {
	RequestID string
	Matches   []domain.MatchResult
	Err       error
}

// ScreeningQueue buffers screening requests for async processing.
type ScreeningQueue struct {
	ch      chan ScreeningRequest
	depth   int
	workers int
}

// NewScreeningQueue creates a queue with the given capacity.
func NewScreeningQueue(depth, workers int) *ScreeningQueue {
	if depth <= 0 {
		depth = DefaultQueueDepth
	}
	if workers <= 0 {
		workers = DefaultWorkers
	}
	return &ScreeningQueue{
		ch:      make(chan ScreeningRequest, depth),
		depth:   depth,
		workers: workers,
	}
}

// Enqueue adds a request. Returns error if queue is full (503 backpressure).
func (q *ScreeningQueue) Enqueue(req ScreeningRequest) error {
	select {
	case q.ch <- req:
		return nil
	default:
		return fmt.Errorf("queue full (%d pending)", q.depth)
	}
}

// Process starts N worker goroutines that pull from the queue.
func (q *ScreeningQueue) Process(ctx context.Context, worker *Worker) {
	for i := 0; i < q.workers; i++ {
		go func(id int) {
			log.Printf("worker %d: started", id)
			worker.Run(ctx, q.ch, id)
		}(i)
	}
}

// Depth returns current queue length.
func (q *ScreeningQueue) Depth() int { return len(q.ch) }

// Cap returns the queue capacity.
func (q *ScreeningQueue) Cap() int { return q.depth }

// Workers returns the configured worker count.
func (q *ScreeningQueue) Workers() int { return q.workers }
