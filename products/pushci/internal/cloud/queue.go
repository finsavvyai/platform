package cloud

import (
	"fmt"
	"sync"
	"time"
)

// Job represents a CI job to run on a cloud runner.
type Job struct {
	ID         string
	RunID      string
	RepoURL    string
	SHA        string
	Steps      []string
	Secrets    map[string]string
	Labels     []string
	EstSeconds int
	CreatedAt  time.Time
}

// Queue is an in-memory job queue (upgradeable to Redis/NATS).
type Queue struct {
	mu       sync.Mutex
	jobs     []*Job
	cancel   map[string]bool
	capacity int
}

// NewQueue creates a queue with the given max capacity.
func NewQueue(capacity int) *Queue {
	return &Queue{
		jobs:     make([]*Job, 0, capacity),
		cancel:   make(map[string]bool),
		capacity: capacity,
	}
}

// Enqueue adds a job to the queue.
func (q *Queue) Enqueue(job Job) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.jobs) >= q.capacity {
		return fmt.Errorf("queue full: %d/%d", len(q.jobs), q.capacity)
	}
	j := job
	q.jobs = append(q.jobs, &j)
	return nil
}

// Dequeue removes and returns the first job matching labels.
// Returns nil if no matching job within timeout.
func (q *Queue) Dequeue(labels []string, timeout time.Duration) *Job {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		q.mu.Lock()
		for i, j := range q.jobs {
			if q.cancel[j.ID] {
				q.jobs = append(q.jobs[:i], q.jobs[i+1:]...)
				delete(q.cancel, j.ID)
				continue
			}
			if q.labelsMatch(j.Labels, labels) {
				q.jobs = append(q.jobs[:i], q.jobs[i+1:]...)
				q.mu.Unlock()
				return j
			}
		}
		q.mu.Unlock()
		time.Sleep(50 * time.Millisecond)
	}
	return nil
}

// Cancel marks a job for removal.
func (q *Queue) Cancel(jobID string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.cancel[jobID] = true
}

// Pending returns the number of queued jobs.
func (q *Queue) Pending() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.jobs)
}

func (q *Queue) labelsMatch(jobLabels, runnerLabels []string) bool {
	have := make(map[string]bool, len(runnerLabels))
	for _, l := range runnerLabels {
		have[l] = true
	}
	for _, l := range jobLabels {
		if !have[l] {
			return false
		}
	}
	return true
}
