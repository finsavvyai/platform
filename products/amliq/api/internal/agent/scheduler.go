package agent

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// Scheduler manages periodic full and delta scans.
type Scheduler struct {
	mu            sync.Mutex
	fullCron      string
	deltaCron     string
	onListUpdate  func()
	nextFullScan  time.Time
	nextDeltaScan time.Time
	stopCh        chan struct{}
}

// NewScheduler creates a new scan scheduler.
func NewScheduler() *Scheduler {
	return &Scheduler{stopCh: make(chan struct{})}
}

// ScheduleFullScan sets the cron expression for full scans.
func (s *Scheduler) ScheduleFullScan(cron string) error {
	interval, err := parseCronInterval(cron)
	if err != nil {
		return fmt.Errorf("invalid full scan cron: %w", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.fullCron = cron
	s.nextFullScan = time.Now().UTC().Add(interval)
	log.Printf("full scan scheduled: next %s", s.nextFullScan.Format(time.RFC3339))
	return nil
}

// ScheduleDeltaScan sets the cron expression for delta scans.
func (s *Scheduler) ScheduleDeltaScan(cron string) error {
	interval, err := parseCronInterval(cron)
	if err != nil {
		return fmt.Errorf("invalid delta scan cron: %w", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deltaCron = cron
	s.nextDeltaScan = time.Now().UTC().Add(interval)
	log.Printf("delta scan scheduled: next %s", s.nextDeltaScan.Format(time.RFC3339))
	return nil
}

// OnListUpdate registers a callback for when new list data arrives.
func (s *Scheduler) OnListUpdate(callback func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onListUpdate = callback
}

// TriggerListUpdate invokes the registered list update callback.
func (s *Scheduler) TriggerListUpdate() {
	s.mu.Lock()
	cb := s.onListUpdate
	s.mu.Unlock()
	if cb != nil {
		cb()
	}
}

// NextRun returns the next scheduled scan time.
func (s *Scheduler) NextRun() time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.nextFullScan.IsZero() {
		return s.nextDeltaScan
	}
	if s.nextDeltaScan.IsZero() || s.nextFullScan.Before(s.nextDeltaScan) {
		return s.nextFullScan
	}
	return s.nextDeltaScan
}

// Stop halts the scheduler.
func (s *Scheduler) Stop() { close(s.stopCh) }
