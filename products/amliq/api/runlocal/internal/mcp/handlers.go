package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/intel"
	"github.com/finsavvyai/pushci/internal/runner"
)

// HandleToolCall dispatches a tool call by name.
func HandleToolCall(params ToolCallParams) ToolCallResult {
	switch params.Name {
	case "pushci_init":
		return handleInit(params.Arguments)
	case "pushci_run":
		return handleRun(params.Arguments)
	case "pushci_status":
		return handleStatus(params.Arguments)
	case "pushci_doctor":
		return handleDoctor(params.Arguments)
	case "pushci_secret_set":
		return handleSecretSet(params.Arguments)
	default:
		return NewErrorResult(fmt.Sprintf("unknown tool: %s", params.Name))
	}
}

func handleInit(args map[string]any) ToolCallResult {
	dir, _ := args["directory"].(string)
	if dir == "" {
		return NewErrorResult("directory is required")
	}
	projects := detect.Scan(dir)
	list := make([]map[string]string, len(projects))
	for i, p := range projects {
		list[i] = map[string]string{
			"stack": string(p.Stack), "dir": p.Dir,
			"framework": p.Framework,
		}
	}
	return jsonResult(map[string]any{
		"projects":    list,
		"config_path": "pushci.yml",
	})
}

func handleRun(args map[string]any) ToolCallResult {
	dir, _ := args["directory"].(string)
	if dir == "" {
		return NewErrorResult("directory is required")
	}
	parallel, _ := args["parallel"].(bool)
	projects := detect.Scan(dir)
	if len(projects) == 0 {
		return NewErrorResult("no projects detected")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	var run *runner.Run
	if parallel {
		run = runner.ExecuteParallel(ctx, dir, projects, 0)
	} else {
		run = runner.Execute(ctx, dir, projects)
	}
	results := make([]map[string]any, len(run.Results))
	for i, r := range run.Results {
		results[i] = map[string]any{
			"check": r.Check, "passed": r.Passed,
			"duration": r.Duration.String(), "output": r.Output,
		}
	}
	return jsonResult(map[string]any{
		"passed": run.Passed, "results": results,
		"duration": run.Elapsed.String(),
	})
}

func handleStatus(args map[string]any) ToolCallResult {
	dir, _ := args["directory"].(string)
	if dir == "" {
		return NewErrorResult("directory is required")
	}
	cache := intel.NewCache(dir)
	cache.Load()
	return jsonResult(map[string]any{"last_run": cache.Entries})
}

func jsonResult(v any) ToolCallResult {
	data, _ := json.Marshal(v)
	return NewTextResult(string(data))
}
