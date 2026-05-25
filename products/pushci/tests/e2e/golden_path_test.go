package e2e

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/detect"
)

// createGoProject writes a minimal Go project into dir.
func createGoProject(t *testing.T, dir string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte("module example.com/golden\n\ngo 1.22\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte("package main\nfunc main() {}\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "main_test.go"), []byte("package main\nimport \"testing\"\nfunc TestOK(t *testing.T) {}\n"), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestGoldenPath_GoProject_DetectStackGenerateYAML(t *testing.T) {
	dir := t.TempDir()
	createGoProject(t, dir)

	// Step 1: detect stack
	projects := detect.Scan(dir)
	if len(projects) == 0 {
		t.Fatal("expected at least one project detected")
	}
	var goProject *detect.Project
	for i := range projects {
		if projects[i].Stack == detect.Go {
			goProject = &projects[i]
			break
		}
	}
	if goProject == nil {
		t.Fatalf("Go stack not detected, got: %+v", projects)
	}
	// Go uses modules, BuildTool is empty string — that's fine.

	// Step 2: generate pipeline YAML using the AI client.
	// Without an API key, GeneratePipeline falls back to defaultYAML.
	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("DEEPSEEK_API_KEY", "")
	t.Setenv("OPEN_AI_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("PUSHCI_AI_PROVIDER", "")

	client := ai.NewClient()
	ctx := context.Background()
	yamlStr, err := ai.GeneratePipeline(ctx, client, projects)
	if err != nil {
		t.Fatalf("GeneratePipeline returned error: %v", err)
	}
	if yamlStr == "" {
		t.Fatal("GeneratePipeline returned empty YAML")
	}

	// Step 3: assert YAML is parseable
	var doc interface{}
	if err := yaml.Unmarshal([]byte(yamlStr), &doc); err != nil {
		t.Errorf("generated YAML is not valid YAML: %v\nYAML:\n%s", err, yamlStr)
	}

	// Step 4: assert it contains expected content
	lower := strings.ToLower(yamlStr)
	if !strings.Contains(lower, "push") && !strings.Contains(lower, "checks") {
		t.Errorf("expected YAML to contain 'push' trigger or 'checks', got:\n%s", yamlStr)
	}
}

func TestGoldenPath_NodeProject_DetectStackGenerateYAML(t *testing.T) {
	dir := t.TempDir()
	pkg := `{"name":"golden-node","version":"1.0.0","scripts":{"test":"jest","build":"tsc"}}`
	if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte(pkg), 0644); err != nil {
		t.Fatal(err)
	}

	projects := detect.Scan(dir)
	var nodeProject *detect.Project
	for i := range projects {
		if projects[i].Stack == detect.Node {
			nodeProject = &projects[i]
			break
		}
	}
	if nodeProject == nil {
		t.Fatalf("Node stack not detected, got: %+v", projects)
	}

	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("PUSHCI_AI_PROVIDER", "")

	client := ai.NewClient()
	ctx := context.Background()
	yamlStr, err := ai.GeneratePipeline(ctx, client, projects)
	if err != nil {
		t.Fatalf("GeneratePipeline returned error: %v", err)
	}
	if yamlStr == "" {
		t.Fatal("GeneratePipeline returned empty YAML")
	}

	var doc interface{}
	if err := yaml.Unmarshal([]byte(yamlStr), &doc); err != nil {
		t.Errorf("generated YAML is not valid YAML: %v\nYAML:\n%s", err, yamlStr)
	}
}

func TestGoldenPath_MultiProject_GeneratesValidYAML(t *testing.T) {
	// Simulate a monorepo with Go + Node projects already detected.
	projects := []detect.Project{
		{Stack: detect.Go, BuildTool: "", Dir: "api"},
		{Stack: detect.Node, BuildTool: detect.ToolNpm, Dir: "web"},
	}

	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("PUSHCI_AI_PROVIDER", "")

	client := ai.NewClient()
	ctx := context.Background()
	yamlStr, err := ai.GeneratePipeline(ctx, client, projects)
	if err != nil {
		t.Fatalf("GeneratePipeline error: %v", err)
	}

	var doc interface{}
	if err := yaml.Unmarshal([]byte(yamlStr), &doc); err != nil {
		t.Errorf("generated YAML is not parseable: %v\nYAML:\n%s", err, yamlStr)
	}
}

func TestGoldenPath_EmptyProjects_DoesNotPanic(t *testing.T) {
	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("PUSHCI_AI_PROVIDER", "")

	client := ai.NewClient()
	ctx := context.Background()

	// Should not panic even with empty project list.
	yamlStr, err := ai.GeneratePipeline(ctx, client, []detect.Project{})
	if err != nil {
		t.Fatalf("unexpected error with empty projects: %v", err)
	}
	_ = yamlStr // result may be minimal but must not panic
}
