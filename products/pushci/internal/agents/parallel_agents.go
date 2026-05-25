package agents

import (
	"context"
	"runtime"
	"sync"
	"time"
)

// ParallelConfig configures parallel agent execution.
type ParallelConfig struct {
	MaxWorkers int
	Isolated   bool
	Strategy   string // "race" or "consensus"
	BasePath   string
}

// AgentResult holds the outcome of a single agent run.
type AgentResult struct {
	Name     string
	Success  bool
	Output   string
	Duration time.Duration
	Actions  []AgentAction
}

// RunParallel runs multiple agents concurrently, optionally in isolated worktrees.
func RunParallel(
	ctx context.Context,
	agentList []*Agent,
	data AgentData,
	config ParallelConfig,
) ([]AgentResult, error) {
	workers := config.MaxWorkers
	if workers <= 0 {
		workers = runtime.NumCPU()
	}
	if workers > len(agentList) {
		workers = len(agentList)
	}

	results := make([]AgentResult, len(agentList))
	jobs := make(chan int, len(agentList))
	var wg sync.WaitGroup

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range jobs {
				if ctx.Err() != nil {
					return
				}
				results[i] = runSingleAgent(ctx, agentList[i], data, config)
			}
		}()
	}

	for i := range agentList {
		jobs <- i
	}
	close(jobs)
	wg.Wait()

	return results, ctx.Err()
}

func runSingleAgent(
	ctx context.Context,
	a *Agent,
	data AgentData,
	config ParallelConfig,
) AgentResult {
	start := time.Now()
	var wtPath string

	if config.Isolated && config.BasePath != "" {
		wt, err := CreateWorktree(WorktreeConfig{
			BasePath: config.BasePath,
			Branch:   string(a.Type),
			Prefix:   "pushci-agent",
		})
		if err == nil {
			wtPath = wt
			defer func() { _ = CleanupWorktree(config.BasePath, wtPath) }()
		}
	}

	actions := a.Analyze(ctx, data)
	return AgentResult{
		Name:     string(a.Type),
		Success:  len(actions) == 0,
		Output:   formatActions(actions),
		Duration: time.Since(start),
		Actions:  actions,
	}
}
