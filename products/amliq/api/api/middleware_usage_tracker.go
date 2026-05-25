package api

import (
	"sync"
	"time"
)

// freeTierTracker counts daily usage per tenant in-memory.
// Resets at midnight UTC. For production, use Redis or DB.
type freeTierTracker struct {
	mu    sync.Mutex
	day   string
	usage map[string]int
}

func newFreeTierTracker() *freeTierTracker {
	return &freeTierTracker{
		day:   today(),
		usage: make(map[string]int),
	}
}

// tryUse increments usage for a tenant. Returns remaining count.
// Negative means limit exceeded.
func (t *freeTierTracker) tryUse(tenantID string) int {
	t.mu.Lock()
	defer t.mu.Unlock()

	d := today()
	if d != t.day {
		t.day = d
		t.usage = make(map[string]int) // reset daily
	}

	t.usage[tenantID]++
	return FreeTierScreeningsPerDay - t.usage[tenantID]
}

// remaining returns how many screenings are left today.
func (t *freeTierTracker) remaining(tenantID string) int {
	t.mu.Lock()
	defer t.mu.Unlock()

	d := today()
	if d != t.day {
		return FreeTierScreeningsPerDay
	}
	used := t.usage[tenantID]
	rem := FreeTierScreeningsPerDay - used
	if rem < 0 {
		return 0
	}
	return rem
}

func today() string {
	return time.Now().UTC().Format("2006-01-02")
}
