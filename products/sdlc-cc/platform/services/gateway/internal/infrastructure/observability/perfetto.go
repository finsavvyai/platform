// Package observability — minimal Perfetto JSON-trace emitter.
//
// Why: BEAT-PLAN BOOST QW4 + INTEGRATION-DEBT Day 19 (k6 baseline
// never executed). We don't have ANY captured latency evidence for
// the wired middleware chain today. A full OpenTelemetry collector
// is overkill for a sprint-1 demo, so this file produces the same
// Chrome-trace-event JSON format that ui.perfetto.dev consumes —
// zero runtime dependencies beyond the standard library.
//
// Wiring (in cmd/server/main.go):
//
//	pf := observability.NewPerfetto(observability.PerfettoConfig{
//	    OutputPath: "perfetto-trace.json",
//	    EnableEnv:  "SDLC_PERFETTO",   // set to "1" to enable
//	})
//	defer pf.Close()
//	r.Use(pf.Middleware())
//
// To capture a trace:
//
//	SDLC_PERFETTO=1 go run ./cmd/server &
//	# generate traffic
//	curl http://localhost:8080/health
//	kill -USR1 $!     # flush buffered events to disk
//
// Then drop perfetto-trace.json into ui.perfetto.dev.
package observability

import (
	"encoding/json"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// PerfettoConfig configures the emitter. Both fields optional —
// defaults give a no-op-on-disabled, sane-when-enabled setup.
type PerfettoConfig struct {
	// OutputPath is where the trace.json gets written on flush.
	// Default: ./perfetto-trace.json in the gateway's cwd.
	OutputPath string
	// EnableEnv is the env var to read for runtime gating. When the
	// env var is unset or empty, every API on Perfetto is a no-op
	// (zero overhead). Default: "SDLC_PERFETTO".
	EnableEnv string
	// MaxEvents bounds the in-memory event buffer. When exceeded the
	// emitter drops oldest events so a long-running gateway doesn't
	// OOM. Default: 100000.
	MaxEvents int
}

// Perfetto is the trace emitter. Safe for concurrent use.
type Perfetto struct {
	cfg     PerfettoConfig
	enabled bool

	mu     sync.Mutex
	events []traceEvent

	stopSig chan struct{}
}

// traceEvent matches the Chrome Trace Event Format that Perfetto
// consumes (https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU).
type traceEvent struct {
	Name string                 `json:"name"`
	Cat  string                 `json:"cat,omitempty"`
	Phase string                `json:"ph"`              // "X" = complete, "B"/"E" = begin/end
	TS   int64                  `json:"ts"`              // microseconds since epoch
	Dur  int64                  `json:"dur,omitempty"`   // microseconds
	PID  int                    `json:"pid"`
	TID  int                    `json:"tid"`
	Args map[string]interface{} `json:"args,omitempty"`
}

// NewPerfetto returns an emitter. When the env gate is unset, all
// downstream calls are cheap no-ops; nothing is buffered, no signal
// handler is installed.
func NewPerfetto(cfg PerfettoConfig) *Perfetto {
	if cfg.OutputPath == "" {
		cfg.OutputPath = "perfetto-trace.json"
	}
	if cfg.EnableEnv == "" {
		cfg.EnableEnv = "SDLC_PERFETTO"
	}
	if cfg.MaxEvents <= 0 {
		cfg.MaxEvents = 100_000
	}
	enabled := os.Getenv(cfg.EnableEnv) != "" && os.Getenv(cfg.EnableEnv) != "0"
	pf := &Perfetto{cfg: cfg, enabled: enabled}
	if enabled {
		pf.events = make([]traceEvent, 0, 1024)
		pf.stopSig = make(chan struct{})
		pf.installFlushSignalHandler()
	}
	return pf
}

// Middleware returns a chi-compatible middleware that records one
// "X" (complete) event per request, with the URL path as the event
// name and the HTTP status in args.
func (p *Perfetto) Middleware() func(http.Handler) http.Handler {
	if !p.enabled {
		return func(next http.Handler) http.Handler { return next }
	}
	pid := os.Getpid()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &perfettoStatusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)
			dur := time.Since(start)
			p.append(traceEvent{
				Name:  r.URL.Path,
				Cat:   "http",
				Phase: "X",
				TS:    start.UnixMicro(),
				Dur:   dur.Microseconds(),
				PID:   pid,
				TID:   1,
				Args: map[string]interface{}{
					"method": r.Method,
					"status": rec.status,
				},
			})
		})
	}
}

// Close flushes any buffered events and stops the signal handler.
func (p *Perfetto) Close() error {
	if !p.enabled {
		return nil
	}
	close(p.stopSig)
	return p.Flush()
}

// Flush writes the current event buffer to OutputPath. Atomic
// write: temp file + rename, so a Perfetto reload mid-flush won't
// see a torn file.
func (p *Perfetto) Flush() error {
	if !p.enabled {
		return nil
	}
	p.mu.Lock()
	snapshot := make([]traceEvent, len(p.events))
	copy(snapshot, p.events)
	p.mu.Unlock()

	tmp := p.cfg.OutputPath + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(f)
	enc.SetIndent("", "")
	if err := enc.Encode(map[string]interface{}{
		"traceEvents": snapshot,
		"displayTimeUnit": "ms",
	}); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, p.cfg.OutputPath)
}

func (p *Perfetto) append(ev traceEvent) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if len(p.events) >= p.cfg.MaxEvents {
		// Drop the oldest 10% so we don't grow unbounded under load.
		drop := p.cfg.MaxEvents / 10
		p.events = append(p.events[:0], p.events[drop:]...)
	}
	p.events = append(p.events, ev)
}

func (p *Perfetto) installFlushSignalHandler() {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGUSR1)
	go func() {
		for {
			select {
			case <-p.stopSig:
				signal.Stop(ch)
				return
			case <-ch:
				_ = p.Flush()
			}
		}
	}()
}

type perfettoStatusRecorder struct {
	http.ResponseWriter
	status int
}

func (p *perfettoStatusRecorder) WriteHeader(status int) {
	p.status = status
	p.ResponseWriter.WriteHeader(status)
}
