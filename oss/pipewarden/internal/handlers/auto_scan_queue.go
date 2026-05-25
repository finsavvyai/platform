package handlers

import (
	"sync"
	"time"
)

// AutoScanJob represents a scan triggered by an inbound webhook event.
type AutoScanJob struct {
	ConnectionName string
	Repo           string
	TriggeredBy    string // "github_push" | "gitlab_push" | "github_pr" | "gitlab_mr"
	QueuedAt       time.Time
}

// AutoScanQueue is a thread-safe in-memory queue of pending auto-scan jobs.
type AutoScanQueue struct {
	mu   sync.Mutex
	jobs []AutoScanJob
}

// NewAutoScanQueue creates an empty AutoScanQueue.
func NewAutoScanQueue() *AutoScanQueue {
	return &AutoScanQueue{}
}

// Enqueue adds a job to the queue.
func (q *AutoScanQueue) Enqueue(job AutoScanJob) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.jobs = append(q.jobs, job)
}

// Drain returns all pending jobs and clears the queue.
func (q *AutoScanQueue) Drain() []AutoScanJob {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := make([]AutoScanJob, len(q.jobs))
	copy(out, q.jobs)
	q.jobs = q.jobs[:0]
	return out
}

// Len returns the number of pending jobs without draining.
func (q *AutoScanQueue) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.jobs)
}
