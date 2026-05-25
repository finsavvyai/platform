package cloud

import (
	"fmt"
	"sync"
)

// PoolStatus holds aggregate runner counts.
type PoolStatus struct {
	Total, Idle, Busy, Pending int
}

type Pool struct {
	mu         sync.Mutex
	runners    map[string]*Runner
	maxRunners int
	minWarm    int
}

func NewPool(minWarm, maxRunners int) *Pool {
	return &Pool{
		runners:    make(map[string]*Runner),
		maxRunners: maxRunners,
		minWarm:    minWarm,
	}
}

func (p *Pool) Add(r *Runner) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.runners[r.ID] = r
}

// Acquire finds an idle runner matching all labels, marks it busy.
func (p *Pool) Acquire(labels []string) (*Runner, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, r := range p.runners {
		if r.Status == StatusIdle && r.MatchesLabels(labels) {
			r.Status = StatusBusy
			return r, nil
		}
	}
	return nil, fmt.Errorf("no idle runner matching labels %v", labels)
}

// Release marks a runner as idle.
func (p *Pool) Release(runnerID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if r, ok := p.runners[runnerID]; ok {
		r.Status = StatusIdle
	}
}

// Scale returns runners to add (positive) or remove (negative).
func (p *Pool) Scale(pending int) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	idle := 0
	for _, r := range p.runners {
		if r.Status == StatusIdle {
			idle++
		}
	}
	if pending > idle {
		need := pending - idle
		if cap := p.maxRunners - len(p.runners); need > cap {
			need = cap
		}
		return need
	}
	if excess := idle - p.minWarm; excess > 0 {
		return -excess
	}
	return 0
}

// Status returns aggregate pool counts.
func (p *Pool) Status(pending int) PoolStatus {
	p.mu.Lock()
	defer p.mu.Unlock()
	s := PoolStatus{Total: len(p.runners), Pending: pending}
	for _, r := range p.runners {
		switch r.Status {
		case StatusIdle:
			s.Idle++
		case StatusBusy:
			s.Busy++
		}
	}
	return s
}

// Remove deletes a runner from the pool.
func (p *Pool) Remove(id string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.runners, id)
}
