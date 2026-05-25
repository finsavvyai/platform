package heal

import (
	"context"
	"log"
	"time"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/runner"
)

// Fix describes a single auto-repair action.
type Fix struct {
	Check        string
	Pattern      string
	Action       string
	FilesChanged []string
}

// HealResult holds the outcome of a self-healing attempt.
type HealResult struct {
	Fixed      bool
	Fixes      []Fix
	RerunResult *runner.Run
}

// Healer diagnoses and repairs CI failures automatically.
type Healer struct {
	Client   *ai.Client
	MaxRetry int
}

// NewHealer creates a healer with default settings.
func NewHealer(client *ai.Client) *Healer {
	return &Healer{Client: client, MaxRetry: 1}
}

// Heal attempts to fix all failed checks in a run.
func (h *Healer) Heal(ctx context.Context, run *runner.Run, root string) (*HealResult, error) {
	result := &HealResult{}
	for _, r := range run.Results {
		if r.Passed {
			continue
		}
		fix := h.diagnoseAndFix(ctx, r, root)
		if fix == nil {
			continue
		}
		if err := ApplyFix(root, fix); err != nil {
			log.Printf("heal: apply fix failed: %v", err)
			continue
		}
		result.Fixes = append(result.Fixes, *fix)
	}
	result.Fixed = len(result.Fixes) > 0
	return result, nil
}

// Rerun re-executes the pipeline after fixes are applied.
func (h *Healer) Rerun(ctx context.Context, root string, projects []detect.Project) *runner.Run {
	ctx2, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	return runner.Execute(ctx2, root, projects)
}

func (h *Healer) diagnoseAndFix(ctx context.Context, r runner.Result, root string) *Fix {
	// Try pattern-based strategies first
	strategies := allStrategies()
	for _, s := range strategies {
		if fix := s(r.Output); fix != nil {
			fix.Check = r.Check
			return fix
		}
	}
	// Fall back to AI
	if h.Client != nil && h.Client.IsConfigured() {
		return aiFix(ctx, h.Client, r.Check, r.Output, root)
	}
	return nil
}
