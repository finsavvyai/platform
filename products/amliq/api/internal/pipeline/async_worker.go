package pipeline

import (
	"context"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/screening"
)

// Worker processes screening requests from the queue.
type Worker struct {
	engine  *screening.Engine
	metrics *Metrics
}

// NewWorker creates a screening worker.
func NewWorker(engine *screening.Engine, metrics *Metrics) *Worker {
	return &Worker{engine: engine, metrics: metrics}
}

// Run loops until context cancels, processing queued requests.
func (w *Worker) Run(ctx context.Context, ch <-chan ScreeningRequest, id int) {
	var count int64

	for {
		select {
		case <-ctx.Done():
			log.Printf("worker %d: stopping after %d screens", id, count)
			return
		case req, ok := <-ch:
			if !ok {
				return
			}
			w.process(req, id, &count)
		}
	}
}

func (w *Worker) process(req ScreeningRequest, id int, count *int64) {
	start := time.Now()

	results, err := w.engine.ScreenByName(
		req.Name, screening.SearchOpts{Limit: 50},
	)

	latency := time.Since(start).Milliseconds()
	w.metrics.RecordScreening(latency)

	if req.Callback != nil {
		req.Callback <- Result{
			RequestID: req.ID,
			Matches:   results,
			Err:       err,
		}
	}

	*count++
	if *count%1000 == 0 {
		stats := w.metrics.Stats()
		log.Printf(
			"worker %d: %d screens, avg %dms, queue %d",
			id, *count, stats.AvgLatencyMs, stats.QueueDepth,
		)
	}
}
