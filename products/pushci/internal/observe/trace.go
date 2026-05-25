package observe

import (
	"encoding/json"
	"io"
	"sync"
	"time"
)

// TraceEvent matches Chrome Trace Event format for Perfetto visualization.
type TraceEvent struct {
	Name string                 `json:"name"`
	Cat  string                 `json:"cat"`
	Ph   string                 `json:"ph"`
	Pid  int                    `json:"pid"`
	Tid  int                    `json:"tid"`
	Ts   int64                  `json:"ts"`
	Dur  int64                  `json:"dur,omitempty"`
	Args map[string]interface{} `json:"args,omitempty"`
}

// Tracer collects trace events for pipeline execution.
type Tracer struct {
	events    []TraceEvent
	startTime time.Time
	mu        sync.Mutex
}

// NewTracer creates a tracer with the current time as epoch.
func NewTracer() *Tracer {
	return &Tracer{
		events:    make([]TraceEvent, 0),
		startTime: time.Now(),
	}
}

// elapsed returns microseconds since tracer start.
func (t *Tracer) elapsed() int64 {
	return time.Since(t.startTime).Microseconds()
}

// Begin emits a "B" (begin) phase event.
func (t *Tracer) Begin(name, category string, tid int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.events = append(t.events, TraceEvent{
		Name: name, Cat: category, Ph: "B",
		Pid: 1, Tid: tid, Ts: t.elapsed(),
	})
}

// End emits an "E" (end) phase event.
func (t *Tracer) End(name, category string, tid int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.events = append(t.events, TraceEvent{
		Name: name, Cat: category, Ph: "E",
		Pid: 1, Tid: tid, Ts: t.elapsed(),
	})
}

// Complete emits an "X" (complete) phase event with duration.
func (t *Tracer) Complete(name, category string, tid int, dur time.Duration) {
	t.mu.Lock()
	defer t.mu.Unlock()
	ts := t.elapsed() - dur.Microseconds()
	if ts < 0 {
		ts = 0
	}
	t.events = append(t.events, TraceEvent{
		Name: name, Cat: category, Ph: "X",
		Pid: 1, Tid: tid, Ts: ts, Dur: dur.Microseconds(),
	})
}

// Events returns a copy of all collected events.
func (t *Tracer) Events() []TraceEvent {
	t.mu.Lock()
	defer t.mu.Unlock()
	out := make([]TraceEvent, len(t.events))
	copy(out, t.events)
	return out
}

// Export writes the trace as a JSON array to w.
func (t *Tracer) Export(w io.Writer) error {
	events := t.Events()
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(events)
}
