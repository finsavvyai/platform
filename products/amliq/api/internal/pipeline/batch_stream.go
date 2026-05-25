package pipeline

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"sync"
	"sync/atomic"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

// BatchResult is the outcome of a single row in a batch stream.
type BatchResult struct {
	Name       string               `json:"name"`
	Matched    bool                 `json:"matched"`
	Confidence float64              `json:"confidence"`
	Matches    []domain.MatchResult `json:"matches,omitempty"`
	Err        string               `json:"error,omitempty"`
}

// BatchProgress tracks streaming batch progress.
type BatchProgress struct{ Processed, Matched, Clean, Errors atomic.Int64 }

// BatchStreamer processes millions of rows via streaming CSV.
type BatchStreamer struct{ engine *screening.Engine; workers int }

// NewBatchStreamer creates a streamer with the given worker count.
func NewBatchStreamer(engine *screening.Engine, workers int) *BatchStreamer {
	if workers <= 0 {
		workers = DefaultWorkers
	}
	return &BatchStreamer{engine: engine, workers: workers}
}

// StreamCSV reads CSV row-by-row, dispatches to workers, calls callback per result.
func (bs *BatchStreamer) StreamCSV(
	ctx context.Context, reader io.Reader, cb func(BatchResult),
) (*BatchProgress, error) {
	cr := csv.NewReader(reader)
	cr.FieldsPerRecord = -1
	names := make(chan string, bs.workers*2)
	p := &BatchProgress{}
	var wg sync.WaitGroup
	for i := 0; i < bs.workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for name := range names {
				r := bs.screenOne(name)
				p.Processed.Add(1)
				switch {
				case r.Err != "":
					p.Errors.Add(1)
				case r.Matched:
					p.Matched.Add(1)
				default:
					p.Clean.Add(1)
				}
				cb(r)
			}
		}()
	}
	for {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			p.Errors.Add(1)
			continue
		}
		if len(rec) == 0 || rec[0] == "" {
			continue
		}
		select {
		case names <- rec[0]:
		case <-ctx.Done():
			break
		}
	}
	close(names)
	wg.Wait()
	log.Printf("batch: ok=%d match=%d clean=%d err=%d", p.Processed.Load(), p.Matched.Load(), p.Clean.Load(), p.Errors.Load())
	return p, nil
}

func (bs *BatchStreamer) screenOne(name string) BatchResult {
	results, err := bs.engine.ScreenByName(name, screening.SearchOpts{Limit: 10})
	if err != nil {
		return BatchResult{Name: name, Err: fmt.Sprintf("screen: %v", err)}
	}
	if len(results) == 0 {
		return BatchResult{Name: name}
	}
	return BatchResult{Name: name, Matched: true, Confidence: results[0].Confidence.Score(), Matches: results}
}
