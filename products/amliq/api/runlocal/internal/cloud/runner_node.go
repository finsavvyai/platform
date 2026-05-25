// Package cloud provides managed runner infrastructure for PushCI.
package cloud

import (
	"time"
)

// RunnerStatus represents the lifecycle state of a runner.
type RunnerStatus string

const (
	StatusIdle     RunnerStatus = "idle"
	StatusBusy     RunnerStatus = "busy"
	StatusStarting RunnerStatus = "starting"
	StatusStopping RunnerStatus = "stopping"
	StatusDead     RunnerStatus = "dead"
)

// Runner represents a provisioned VM running the PushCI agent.
type Runner struct {
	ID            string
	IP            string
	Status        RunnerStatus
	Labels        []string
	OS            string
	Arch          string
	CreatedAt     time.Time
	LastHeartbeat time.Time
}

const heartbeatTimeout = 60 * time.Second

// IsAlive returns true if the runner sent a heartbeat within 60s.
func (r *Runner) IsAlive() bool {
	return time.Since(r.LastHeartbeat) < heartbeatTimeout
}

// MatchesLabels returns true if the runner has all required labels.
func (r *Runner) MatchesLabels(required []string) bool {
	have := make(map[string]bool, len(r.Labels))
	for _, l := range r.Labels {
		have[l] = true
	}
	for _, req := range required {
		if !have[req] {
			return false
		}
	}
	return true
}
