package runner

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestChecksForProject(t *testing.T) {
	tests := []struct {
		name      string
		project   detect.Project
		wantNames []string
	}{
		{
			"go", detect.Project{Stack: detect.Go},
			[]string{"build", "test"},
		},
		{
			"rust", detect.Project{Stack: detect.Rust},
			[]string{"build", "test"},
		},
		{
			"csharp", detect.Project{Stack: detect.CSharp},
			[]string{"build", "test"},
		},
		{
			"ruby", detect.Project{Stack: detect.Ruby},
			[]string{"install", "test"},
		},
		{
			"node default", detect.Project{Stack: detect.Node},
			[]string{"tsc", "test", "build"},
		},
		{
			"python pip", detect.Project{Stack: detect.Python, BuildTool: detect.ToolPip},
			[]string{"install", "test"},
		},
		{
			"java maven", detect.Project{Stack: detect.Java, BuildTool: detect.ToolMaven},
			[]string{"build", "test"},
		},
		{
			"java gradle", detect.Project{Stack: detect.Java, BuildTool: detect.ToolGradle},
			[]string{"build", "test"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := checksForProject(tt.project)
			if len(got) != len(tt.wantNames) {
				t.Fatalf("got %d checks, want %d", len(got), len(tt.wantNames))
			}
			for i, name := range tt.wantNames {
				if got[i].name != name {
					t.Errorf("check[%d].name = %q, want %q", i, got[i].name, name)
				}
			}
		})
	}
}

func TestGoChecksCommands(t *testing.T) {
	checks := goChecks()
	if checks[0].cmd != "go" || checks[0].args[0] != "build" {
		t.Errorf("go build check = %s %v", checks[0].cmd, checks[0].args)
	}
	if checks[1].cmd != "go" || checks[1].args[0] != "test" {
		t.Errorf("go test check = %s %v", checks[1].cmd, checks[1].args)
	}
}

func TestNodeNextjsChecks(t *testing.T) {
	p := detect.Project{Stack: detect.Node, Framework: "nextjs"}
	checks := checksForProject(p)
	// Should have tsc, test (jest), build (next build)
	if len(checks) != 3 {
		t.Fatalf("got %d checks, want 3", len(checks))
	}
	if checks[1].args[0] != "jest" {
		t.Errorf("test runner = %q, want jest", checks[1].args[0])
	}
	if checks[2].args[0] != "next" {
		t.Errorf("build cmd = %q, want next", checks[2].args[0])
	}
}

func TestPythonDjangoChecks(t *testing.T) {
	p := detect.Project{Stack: detect.Python, Framework: "django"}
	checks := checksForProject(p)
	if len(checks) != 2 {
		t.Fatalf("got %d checks, want 2", len(checks))
	}
	if checks[1].cmd != "python" {
		t.Errorf("django test cmd = %q, want python", checks[1].cmd)
	}
}
