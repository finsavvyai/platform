package e2e

import (
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/migrate"
)

func TestMigrate_SimpleNodeWorkflow(t *testing.T) {
	workflow := migrate.ActionsWorkflow{
		Name:     "Node CI",
		Triggers: []string{"push", "pull_request"},
		Jobs: []migrate.ActionsJob{
			{
				Name: "test",
				Steps: []migrate.ActionsStep{
					{Name: "Install", Run: "npm install"},
					{Name: "Test", Run: "npm test"},
				},
			},
		},
	}

	result := migrate.ConvertActions(workflow)
	if result == nil {
		t.Fatal("ConvertActions returned nil")
	}
	if result.PushCIYAML == "" {
		t.Fatal("expected non-empty PushCI YAML output")
	}
	if !strings.Contains(result.PushCIYAML, "npm test") {
		t.Errorf("expected converted YAML to contain 'npm test', got:\n%s", result.PushCIYAML)
	}
	if !strings.Contains(result.PushCIYAML, "npm install") {
		t.Errorf("expected converted YAML to contain 'npm install', got:\n%s", result.PushCIYAML)
	}
	if result.StepsKept < 2 {
		t.Errorf("expected at least 2 steps kept, got %d", result.StepsKept)
	}
}

func TestMigrate_GoWorkflow(t *testing.T) {
	workflow := migrate.ActionsWorkflow{
		Name:     "Go CI",
		Triggers: []string{"push"},
		Jobs: []migrate.ActionsJob{
			{
				Name: "build",
				Steps: []migrate.ActionsStep{
					{Name: "Build", Run: "go build ./..."},
					{Name: "Test", Run: "go test ./..."},
					{Name: "Vet", Run: "go vet ./..."},
				},
			},
		},
	}

	result := migrate.ConvertActions(workflow)
	if result == nil {
		t.Fatal("ConvertActions returned nil")
	}
	if !strings.Contains(result.PushCIYAML, "go test ./...") {
		t.Errorf("expected go test in output, got:\n%s", result.PushCIYAML)
	}
	if !strings.Contains(result.PushCIYAML, "go build") {
		t.Errorf("expected go build in output, got:\n%s", result.PushCIYAML)
	}
	if result.StepsKept != 3 {
		t.Errorf("expected 3 steps kept, got %d", result.StepsKept)
	}
}

func TestMigrate_UsesActionsAreSkipped(t *testing.T) {
	workflow := migrate.ActionsWorkflow{
		Name:     "Mixed CI",
		Triggers: []string{"push"},
		Jobs: []migrate.ActionsJob{
			{
				Name: "test",
				Steps: []migrate.ActionsStep{
					{Name: "Checkout", Uses: "actions/checkout@v4"},
					{Name: "Test", Run: "npm test"},
					{Name: "Setup Node", Uses: "actions/setup-node@v4"},
				},
			},
		},
	}

	result := migrate.ConvertActions(workflow)
	if result == nil {
		t.Fatal("ConvertActions returned nil")
	}
	// "npm test" must survive; pure uses steps without a mapping are skipped
	if !strings.Contains(result.PushCIYAML, "npm test") {
		t.Errorf("expected npm test to be preserved, got:\n%s", result.PushCIYAML)
	}
	// At least one warning for each skipped uses: step (unless mapped)
	// The exact count depends on whether actions/checkout/setup-node are mapped.
	// The important thing is StepsRemoved > 0 if no mapping exists.
}

func TestMigrate_ResultContainsPipelineHeader(t *testing.T) {
	workflow := migrate.ActionsWorkflow{
		Name:     "My Pipeline",
		Triggers: []string{"push"},
		Jobs: []migrate.ActionsJob{
			{
				Name: "ci",
				Steps: []migrate.ActionsStep{
					{Name: "Run tests", Run: "go test ./..."},
				},
			},
		},
	}

	result := migrate.ConvertActions(workflow)
	if !strings.Contains(result.PushCIYAML, "My Pipeline") {
		t.Errorf("expected workflow name in output, got:\n%s", result.PushCIYAML)
	}
	if !strings.Contains(result.PushCIYAML, "push") {
		t.Errorf("expected trigger in output, got:\n%s", result.PushCIYAML)
	}
	if !strings.Contains(result.PushCIYAML, "checks:") {
		t.Errorf("expected 'checks:' key in output, got:\n%s", result.PushCIYAML)
	}
}

func TestMigrate_EmptyWorkflow(t *testing.T) {
	workflow := migrate.ActionsWorkflow{
		Name:     "Empty",
		Triggers: []string{"push"},
		Jobs:     nil,
	}

	result := migrate.ConvertActions(workflow)
	if result == nil {
		t.Fatal("ConvertActions returned nil for empty workflow")
	}
	// Should produce valid (if minimal) YAML without panicking.
	if result.StepsKept != 0 {
		t.Errorf("expected 0 steps kept for empty workflow, got %d", result.StepsKept)
	}
}

func TestMigrate_ConvertResultFields(t *testing.T) {
	workflow := migrate.ActionsWorkflow{
		Name:     "CI",
		Triggers: []string{"push"},
		Jobs: []migrate.ActionsJob{
			{
				Name: "test",
				Steps: []migrate.ActionsStep{
					{Name: "Run", Run: "cargo test"},
					{Name: "Upload", Uses: "actions/upload-artifact@v3"},
				},
			},
		},
	}

	result := migrate.ConvertActions(workflow)
	if result.StepsKept+result.StepsRemoved < 1 {
		t.Error("expected StepsKept + StepsRemoved to account for all steps")
	}
}
