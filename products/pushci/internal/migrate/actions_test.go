package migrate

import "testing"

func TestConvertActions(t *testing.T) {
	workflow := ActionsWorkflow{
		Name:     "CI",
		Triggers: []string{"push", "pull_request"},
		Jobs: []ActionsJob{
			{Name: "build", Steps: []ActionsStep{
				{Name: "Checkout", Uses: "actions/checkout@v4"},
				{Name: "Setup Node", Uses: "actions/setup-node@v4"},
				{Name: "Install", Run: "npm install"},
				{Name: "Test", Run: "npm test"},
				{Name: "Build", Run: "npm run build"},
			}},
		},
	}
	result := ConvertActions(workflow)
	if result.StepsKept != 3 {
		t.Errorf("kept = %d, want 3", result.StepsKept)
	}
	if result.StepsRemoved != 2 {
		t.Errorf("removed = %d, want 2 (checkout + setup)", result.StepsRemoved)
	}
	if result.PushCIYAML == "" {
		t.Error("expected non-empty YAML")
	}
}

func TestConvertActionsDocker(t *testing.T) {
	workflow := ActionsWorkflow{
		Name:     "Docker",
		Triggers: []string{"push"},
		Jobs: []ActionsJob{
			{Name: "docker", Steps: []ActionsStep{
				{Name: "Build", Uses: "docker/build-push-action@v5"},
			}},
		},
	}
	result := ConvertActions(workflow)
	if result.StepsKept != 1 {
		t.Errorf("kept = %d, want 1", result.StepsKept)
	}
}

func TestConvertActionsEmpty(t *testing.T) {
	result := ConvertActions(ActionsWorkflow{Name: "empty", Triggers: []string{"push"}})
	if result.StepsKept != 0 {
		t.Errorf("kept = %d, want 0", result.StepsKept)
	}
}
