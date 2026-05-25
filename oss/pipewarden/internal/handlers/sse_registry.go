package handlers

import "sync"

// ProgressEvent represents a single scan progress update.
type ProgressEvent struct {
	Stage   string `json:"stage"`   // "connecting" | "scanning" | "analyzing" | "complete" | "error"
	Percent int    `json:"percent"` // 0-100
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

// ScanProgressRegistry manages in-memory SSE channels keyed by runID.
type ScanProgressRegistry struct {
	mu    sync.RWMutex
	chans map[string]chan ProgressEvent
}

// NewScanProgressRegistry creates a new empty registry.
func NewScanProgressRegistry() *ScanProgressRegistry {
	return &ScanProgressRegistry{
		chans: make(map[string]chan ProgressEvent),
	}
}

// Register creates and stores a channel for the given runID.
// Returns a receive-only channel the SSE handler can read from.
func (r *ScanProgressRegistry) Register(runID string) <-chan ProgressEvent {
	r.mu.Lock()
	defer r.mu.Unlock()
	ch := make(chan ProgressEvent, 16)
	r.chans[runID] = ch
	return ch
}

// Publish sends an event to the channel for runID.
// It is a no-op if runID is not registered.
func (r *ScanProgressRegistry) Publish(runID string, event ProgressEvent) {
	r.mu.RLock()
	ch, ok := r.chans[runID]
	r.mu.RUnlock()
	if !ok {
		return
	}
	select {
	case ch <- event:
	default:
		// channel full — drop rather than block
	}
}

// Complete closes and removes the channel for runID.
func (r *ScanProgressRegistry) Complete(runID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if ch, ok := r.chans[runID]; ok {
		close(ch)
		delete(r.chans, runID)
	}
}
