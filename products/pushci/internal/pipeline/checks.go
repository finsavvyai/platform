package pipeline

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/finsavvyai/pushci/internal/config"
)

func runSequential(ctx context.Context, root string, checks []config.Check, env map[string]string) []CheckResult {
	var results []CheckResult
	for _, check := range checks {
		r := runCheck(ctx, root, check, env)
		results = append(results, r)
		if !r.Passed && check.OnFail == "block" {
			break
		}
	}
	return results
}

func runParallel(ctx context.Context, root string, checks []config.Check, env map[string]string) []CheckResult {
	results := make([]CheckResult, len(checks))
	var wg sync.WaitGroup
	for i, check := range checks {
		wg.Add(1)
		go func(idx int, c config.Check) {
			defer wg.Done()
			results[idx] = runCheck(ctx, root, c, env)
		}(i, check)
	}
	wg.Wait()
	return results
}

func runCheck(ctx context.Context, root string, check config.Check, stageEnv map[string]string) CheckResult {
	cmd := check.Run
	if cmd == "" {
		cmd = check.Name
	}
	if check.If != "" && !evaluateCondition(check.If) {
		return CheckResult{Name: check.Name, Passed: true, Output: "skipped"}
	}

	maxRetries := check.Retry
	if maxRetries < 1 {
		maxRetries = 1
	}

	var result CheckResult
	for attempt := 0; attempt < maxRetries; attempt++ {
		start := time.Now()
		output, err := shellExec(ctx, root, cmd, stageEnv)
		result = CheckResult{
			Name: check.Name, Passed: err == nil,
			Output: output, Duration: time.Since(start),
		}
		if result.Passed {
			break
		}
	}
	return result
}

func shellExec(ctx context.Context, dir, command string, env map[string]string) (string, error) {
	if command == "" {
		return "", nil
	}
	parts := strings.Fields(command)
	if len(parts) == 0 {
		return "", nil
	}
	cmd := exec.CommandContext(ctx, parts[0], parts[1:]...)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	for k, v := range env {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func evaluateCondition(cond string) bool {
	if strings.Contains(cond, "==") {
		parts := strings.SplitN(cond, "==", 2)
		if len(parts) == 2 {
			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])
			if left == "branch" {
				return os.Getenv("PUSHCI_BRANCH") == right
			}
			return os.Getenv(left) == right
		}
	}
	return true
}
