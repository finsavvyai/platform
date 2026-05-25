package agent

import (
	"context"
	"fmt"
	"sync"
)

// BatchScan screens a batch of customers against the loaded index.
// Only customers with matches are included in the result.
func (a *Agent) BatchScan(
	ctx context.Context, customers []CustomerRecord,
) ([]BatchResult, error) {
	if a.Engine == nil {
		return nil, fmt.Errorf("engine not initialized")
	}
	workers := a.config.WorkerCount
	if workers <= 0 {
		workers = 4
	}

	results := make([]BatchResult, 0)
	var mu sync.Mutex
	var wg sync.WaitGroup
	ch := make(chan CustomerRecord, len(customers))

	for _, c := range customers {
		ch <- c
	}
	close(ch)

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for cust := range ch {
				if ctx.Err() != nil {
					return
				}
				br := a.screenCustomer(cust)
				if br.Matched {
					mu.Lock()
					results = append(results, br)
					mu.Unlock()
				}
			}
		}()
	}
	wg.Wait()
	return results, ctx.Err()
}

// screenCustomer screens one customer and returns a BatchResult.
func (a *Agent) screenCustomer(cust CustomerRecord) BatchResult {
	matches, err := a.Engine.ScreenByName(cust.Name, screening_opts())
	br := BatchResult{CustomerID: cust.ID}
	if err != nil || len(matches) == 0 {
		return br
	}
	br.Matched = true
	br.RiskLevel = riskLevel(matches)
	for _, m := range matches {
		br.Matches = append(br.Matches, toMatchDetail(m))
	}
	return br
}
