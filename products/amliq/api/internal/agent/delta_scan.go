package agent

import (
	"context"
	"sync"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

// DeltaAction describes the type of delta screening change.
type DeltaAction string

const (
	ActionNewMatch    DeltaAction = "new_match"
	ActionRemoved     DeltaAction = "match_removed"
	ActionScoreChange DeltaAction = "score_changed"
)

// DeltaResult holds the outcome of a delta scan for one customer.
type DeltaResult struct {
	CustomerID string
	Action     DeltaAction
	Detail     MatchDetail
}

// DeltaScan screens customers only against new/changed entities.
func (a *Agent) DeltaScan(
	ctx context.Context,
	customers []CustomerRecord,
	newEntities []domain.Entity,
	removedIDs []string,
) ([]DeltaResult, error) {
	if len(newEntities) == 0 && len(removedIDs) == 0 {
		return nil, nil
	}
	tmpIdx := screening.NewSearchIndex()
	tmpIdx.Load(newEntities)
	tmpEngine := screening.NewEngine(nil, screening.WithSearchIndex(tmpIdx))
	removedSet := toSet(removedIDs)

	results := make([]DeltaResult, 0)
	var mu sync.Mutex
	var wg sync.WaitGroup
	ch := make(chan CustomerRecord, len(customers))
	for _, c := range customers {
		ch <- c
	}
	close(ch)

	workers := a.config.WorkerCount
	if workers <= 0 {
		workers = 4
	}
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for cust := range ch {
				if ctx.Err() != nil {
					return
				}
				dr := deltaScreenOne(tmpEngine, cust, removedSet)
				if len(dr) > 0 {
					mu.Lock()
					results = append(results, dr...)
					mu.Unlock()
				}
			}
		}()
	}
	wg.Wait()
	return results, ctx.Err()
}
