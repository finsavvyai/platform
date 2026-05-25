package runner

import (
	"context"
	"runtime"
	"sync"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
)

// ExecuteParallel runs checks for all projects concurrently.
func ExecuteParallel(
	ctx context.Context,
	root string,
	projects []detect.Project,
	maxWorkers int,
) *Run {
	if maxWorkers <= 0 {
		maxWorkers = runtime.NumCPU()
	}
	run := &Run{Started: time.Now()}

	type indexed struct {
		idx     int
		results []Result
	}

	jobs := make(chan int, len(projects))
	out := make(chan indexed, len(projects))

	var wg sync.WaitGroup
	for w := 0; w < min(maxWorkers, len(projects)); w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range jobs {
				p := projects[i]
				dir := root
				if p.Dir != "." {
					dir = root + "/" + p.Dir
				}
				res := runChecks(ctx, p, dir)
				out <- indexed{idx: i, results: res}
			}
		}()
	}

	for i := range projects {
		jobs <- i
	}
	close(jobs)

	go func() {
		wg.Wait()
		close(out)
	}()

	collected := make([][]Result, len(projects))
	for item := range out {
		collected[item.idx] = item.results
	}

	for _, res := range collected {
		run.Results = append(run.Results, res...)
	}
	run.Elapsed = time.Since(run.Started)
	run.Passed = true
	for _, r := range run.Results {
		if !r.Passed {
			run.Passed = false
			break
		}
	}
	return run
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
