package cloud

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// BurstManager provisions ephemeral runners when the pool is full.
type BurstManager struct {
	mu          sync.Mutex
	provisioner Provisioner
	maxBurst    int
	active      map[string]time.Time // runner ID → expiry
}

// NewBurstManager creates a burst manager with the given provisioner.
func NewBurstManager(prov Provisioner, maxBurst int) *BurstManager {
	return &BurstManager{
		provisioner: prov,
		maxBurst:    maxBurst,
		active:      make(map[string]time.Time),
	}
}

// Burst provisions an ephemeral runner for a single job.
// The runner auto-destroys after the job's estimated duration + 60s.
func (bm *BurstManager) Burst(ctx context.Context, job *Job) (*Runner, error) {
	bm.mu.Lock()
	defer bm.mu.Unlock()
	if len(bm.active) >= bm.maxBurst {
		return nil, fmt.Errorf("burst limit reached: %d/%d", len(bm.active), bm.maxBurst)
	}
	spec := VMSpec{
		Name:   fmt.Sprintf("burst-%s", job.ID),
		Labels: job.Labels,
		Image:  "ubuntu-22.04",
		Size:   "cx21",
	}
	r, err := bm.provisioner.Create(spec)
	if err != nil {
		return nil, fmt.Errorf("burst provision: %w", err)
	}
	r.Status = StatusIdle
	ttl := EstimateDuration(job) + 60*time.Second
	bm.active[r.ID] = time.Now().Add(ttl)
	go bm.autoDestroy(r.ID, ttl)
	return r, nil
}

// ActiveBursts returns the number of active burst runners.
func (bm *BurstManager) ActiveBursts() int {
	bm.mu.Lock()
	defer bm.mu.Unlock()
	return len(bm.active)
}

func (bm *BurstManager) autoDestroy(id string, ttl time.Duration) {
	time.Sleep(ttl)
	bm.mu.Lock()
	delete(bm.active, id)
	bm.mu.Unlock()
	_ = bm.provisioner.Destroy(id)
}
