package runner

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestNodeGatsbyChecks(t *testing.T) {
	p := detect.Project{Stack: detect.Node, Framework: "gatsby"}
	checks := checksForProject(p)
	if len(checks) != 3 {
		t.Fatalf("got %d checks, want 3", len(checks))
	}
	if checks[2].args[0] != "gatsby" {
		t.Errorf("build cmd = %q, want gatsby", checks[2].args[0])
	}
}

func TestNodeDocusaurusChecks(t *testing.T) {
	p := detect.Project{Stack: detect.Node, Framework: "docusaurus"}
	checks := checksForProject(p)
	if len(checks) != 3 {
		t.Fatalf("got %d checks, want 3", len(checks))
	}
	if checks[2].args[0] != "docusaurus" {
		t.Errorf("build cmd = %q, want docusaurus", checks[2].args[0])
	}
}

func TestNodeStorybookChecks(t *testing.T) {
	p := detect.Project{Stack: detect.Node, Framework: "storybook"}
	checks := checksForProject(p)
	if len(checks) != 3 {
		t.Fatalf("got %d checks, want 3", len(checks))
	}
	if checks[2].args[0] != "storybook" {
		t.Errorf("build cmd = %q, want storybook", checks[2].args[0])
	}
}

func TestNodeExpoChecks(t *testing.T) {
	p := detect.Project{Stack: detect.Node, Framework: "expo"}
	checks := checksForProject(p)
	if len(checks) != 3 {
		t.Fatalf("got %d checks, want 3", len(checks))
	}
	// Expo uses jest for testing
	if checks[1].args[0] != "jest" {
		t.Errorf("test runner = %q, want jest", checks[1].args[0])
	}
}

func TestNodeElysiaChecks(t *testing.T) {
	p := detect.Project{Stack: detect.Node, Framework: "elysia"}
	checks := checksForProject(p)
	if len(checks) != 3 {
		t.Fatalf("got %d checks, want 3", len(checks))
	}
	// Elysia uses vitest by default
	if checks[1].args[0] != "vitest" {
		t.Errorf("test runner = %q, want vitest", checks[1].args[0])
	}
}

func TestNodeHonoChecks(t *testing.T) {
	p := detect.Project{Stack: detect.Node, Framework: "hono"}
	checks := checksForProject(p)
	if len(checks) != 3 {
		t.Fatalf("got %d checks, want 3", len(checks))
	}
	if checks[1].args[0] != "vitest" {
		t.Errorf("test runner = %q, want vitest", checks[1].args[0])
	}
}
