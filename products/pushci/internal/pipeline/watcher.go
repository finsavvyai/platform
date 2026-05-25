package pipeline

import (
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
)

// WatchResult describes the outcome of a pipeline watch check.
type WatchResult struct {
	Changed  bool
	Changes  []Change
	Applied  bool
	Snapshot time.Time
}

// Watcher monitors a repo for changes that require pipeline updates.
type Watcher struct {
	Root     string
	Interval time.Duration
	stop     chan struct{}
}

// NewWatcher creates a pipeline watcher with the given check interval.
func NewWatcher(root string, interval time.Duration) *Watcher {
	return &Watcher{Root: root, Interval: interval, stop: make(chan struct{})}
}

// CheckOnce scans the repo and returns any needed pipeline changes.
func (w *Watcher) CheckOnce() (*WatchResult, error) {
	projects := detect.Scan(w.Root)
	cfgPath := filepath.Join(w.Root, "pushci.yml")
	if _, err := os.Stat(cfgPath); os.IsNotExist(err) {
		return &WatchResult{Changed: false, Snapshot: time.Now()}, nil
	}
	u := NewUpdater()
	changes, err := u.Check(w.Root)
	if err != nil {
		return nil, err
	}
	_ = projects
	return &WatchResult{
		Changed:  len(changes) > 0,
		Changes:  changes,
		Applied:  false,
		Snapshot: time.Now(),
	}, nil
}

// AutoApply checks and auto-applies pipeline changes if needed.
func (w *Watcher) AutoApply() (*WatchResult, error) {
	result, err := w.CheckOnce()
	if err != nil || !result.Changed {
		return result, err
	}
	u := NewUpdater()
	if err := u.Apply(w.Root, result.Changes); err != nil {
		return result, err
	}
	result.Applied = true
	log.Printf("pipeline: auto-applied %d changes", len(result.Changes))
	return result, nil
}

// Watch starts a background watcher loop. Call Stop() to end it.
func (w *Watcher) Watch(onChange func([]Change)) {
	go func() {
		ticker := time.NewTicker(w.Interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				result, err := w.CheckOnce()
				if err != nil {
					log.Printf("pipeline watcher: %v", err)
					continue
				}
				if result.Changed && onChange != nil {
					onChange(result.Changes)
				}
			case <-w.stop:
				return
			}
		}
	}()
}

// Stop halts the background watcher.
func (w *Watcher) Stop() { close(w.stop) }
