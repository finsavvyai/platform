package cloud

import "time"

// Router selects the best runner for a job based on labels and timing.
type Router struct{}

// NewRouter creates a new smart runner router.
func NewRouter() *Router { return &Router{} }

// Route picks the best runner from the pool for a job.
// Returns the runner and a human-readable reason string.
func (rt *Router) Route(job *Job, pool *Pool) (*Runner, string) {
	if hasLabel(job.Labels, "gpu") {
		r, err := pool.Acquire([]string{"gpu"})
		if err == nil {
			return r, "gpu (label match)"
		}
	}
	if hasLabel(job.Labels, "macos") {
		r, err := pool.Acquire([]string{"macos"})
		if err == nil {
			return r, "macos (label match)"
		}
	}
	est := EstimateDuration(job)
	if est < 30*time.Second {
		r, err := pool.Acquire([]string{"local"})
		if err == nil {
			return r, "local (fast job)"
		}
	}
	if est > 5*time.Minute {
		r, err := pool.Acquire([]string{"cloud"})
		if err == nil {
			return r, "cloud (heavy build)"
		}
	}
	// Try any idle runner.
	r, err := pool.Acquire(job.Labels)
	if err == nil {
		return r, "pool (available)"
	}
	return nil, "burst (no idle runners)"
}

// EstimateDuration estimates job duration from step count.
func EstimateDuration(job *Job) time.Duration {
	if job.EstSeconds > 0 {
		return time.Duration(job.EstSeconds) * time.Second
	}
	n := len(job.Steps)
	if n == 0 {
		n = 1
	}
	return time.Duration(n) * 30 * time.Second
}

func hasLabel(labels []string, target string) bool {
	for _, l := range labels {
		if l == target {
			return true
		}
	}
	return false
}
