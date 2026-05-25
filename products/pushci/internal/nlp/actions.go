package nlp

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/deploy"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/runner"
)

// ExecuteAction dispatches an action to the appropriate subsystem.
func ExecuteAction(ctx context.Context, action *Action, root string) (string, error) {
	switch action.Type {
	case "run":
		return execRun(ctx, action, root)
	case "deploy":
		return execDeploy(ctx, action, root)
	case "diagnose":
		return execDiagnose(ctx, root)
	case "status":
		return execStatus(action)
	case "config":
		return execConfig(action, root)
	case "secret":
		return execSecret(action, root)
	case "optimize":
		return execOptimize(ctx, root)
	case "fix_pipeline":
		return execFixPipeline(ctx, root)
	case "generate":
		return execGenerate(ctx, root)
	case "heal":
		return execHeal(ctx, root)
	default:
		return "", fmt.Errorf("unknown action type: %s", action.Type)
	}
}

func execRun(ctx context.Context, _ *Action, root string) (string, error) {
	projects := detect.Scan(root)
	if len(projects) == 0 {
		return "", fmt.Errorf("no projects detected in %s", root)
	}
	result := runner.Execute(ctx, root, projects)
	status := "PASSED"
	if !result.Passed {
		status = "FAILED"
	}
	return fmt.Sprintf("Pipeline %s (%d checks, %s)", status,
		len(result.Results), result.Elapsed), nil
}

func execDeploy(ctx context.Context, action *Action, root string) (string, error) {
	target := deploy.Target(action.Params["target"])
	if target == "" {
		return "", fmt.Errorf("deploy target not specified")
	}
	result := deploy.Deploy(ctx, target, root, nil)
	if !result.Success {
		return "", fmt.Errorf("deploy failed: %s", result.Output)
	}
	msg := fmt.Sprintf("Deployed to %s", target)
	if result.URL != "" {
		msg += fmt.Sprintf(" — %s", result.URL)
	}
	return msg, nil
}

func execDiagnose(ctx context.Context, root string) (string, error) {
	client := ai.NewClient()
	projects := detect.Scan(root)
	result := runner.Execute(ctx, root, projects)
	diagnoses := ai.DiagnoseRun(ctx, client, result)
	if len(diagnoses) == 0 {
		return "No failures to diagnose.", nil
	}
	var parts []string
	for _, d := range diagnoses {
		parts = append(parts, fmt.Sprintf("[%s] %s\nFix: %s",
			d.Check, d.Explanation, d.Suggestion))
	}
	return strings.Join(parts, "\n\n"), nil
}

func execStatus(action *Action) (string, error) {
	if raw, ok := action.Params["raw"]; ok {
		return raw, nil
	}
	return "Status: use `pushci status` for detailed results.", nil
}
