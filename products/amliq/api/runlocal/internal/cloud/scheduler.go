package cloud

import (
	"context"
	"log"
	"time"
)

// Scheduler connects the job queue to the runner pool.
type Scheduler struct {
	Queue       *Queue
	Pool        *Pool
	Provisioner Provisioner
	PollInterval time.Duration
}

// NewScheduler creates a scheduler with default 2s poll interval.
func NewScheduler(q *Queue, p *Pool, prov Provisioner) *Scheduler {
	return &Scheduler{
		Queue:        q,
		Pool:         p,
		Provisioner:  prov,
		PollInterval: 2 * time.Second,
	}
}

// Run loops: dequeue jobs, acquire runners, dispatch work.
func (s *Scheduler) Run(ctx context.Context) {
	ticker := time.NewTicker(s.PollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.tick()
		}
	}
}

func (s *Scheduler) tick() {
	pending := s.Queue.Pending()
	if pending == 0 {
		return
	}
	s.autoScale(pending)
	job := s.Queue.Dequeue([]string{}, 100*time.Millisecond)
	if job == nil {
		return
	}
	runner, err := s.Pool.Acquire(job.Labels)
	if err != nil {
		log.Printf("scheduler: no runner for job %s: %v", job.ID, err)
		_ = s.Queue.Enqueue(*job)
		return
	}
	s.dispatch(runner, job)
}

func (s *Scheduler) autoScale(pending int) {
	need := s.Pool.Scale(pending)
	for i := 0; i < need; i++ {
		spec := VMSpec{
			Name:  "auto",
			Image: "ubuntu-22.04",
			Size:  "cx21",
		}
		r, err := s.Provisioner.Create(spec)
		if err != nil {
			log.Printf("scheduler: provision failed: %v", err)
			return
		}
		r.Status = StatusIdle
		s.Pool.Add(r)
	}
}

// dispatch sends the job to the runner's agent HTTP endpoint.
// In production this POSTs to http://<runner.IP>:9090/run.
func (s *Scheduler) dispatch(runner *Runner, job *Job) {
	log.Printf("scheduler: dispatching job %s to runner %s",
		job.ID, runner.ID)
}

// Monitor checks heartbeats and marks dead runners.
func (s *Scheduler) Monitor() {
	s.Pool.mu.Lock()
	defer s.Pool.mu.Unlock()
	for _, r := range s.Pool.runners {
		if r.Status == StatusBusy && !r.IsAlive() {
			r.Status = StatusDead
			log.Printf("scheduler: runner %s is dead", r.ID)
		}
	}
}
