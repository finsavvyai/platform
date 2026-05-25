package runner

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestChecksForNewStacks(t *testing.T) {
	tests := []struct {
		name      string
		project   detect.Project
		wantNames []string
	}{
		{"cpp cmake", detect.Project{Stack: detect.Cpp, BuildTool: detect.ToolCMake},
			[]string{"build", "test"}},
		{"cpp make", detect.Project{Stack: detect.Cpp, BuildTool: detect.ToolMake},
			[]string{"build", "test"}},
		{"scala", detect.Project{Stack: detect.Scala},
			[]string{"build", "test"}},
		{"haskell stack", detect.Project{Stack: detect.Haskell, BuildTool: detect.ToolStack},
			[]string{"build", "test"}},
		{"haskell cabal", detect.Project{Stack: detect.Haskell, BuildTool: detect.ToolCabal},
			[]string{"build", "test"}},
		{"zig", detect.Project{Stack: detect.Zig},
			[]string{"build", "test"}},
		{"deno", detect.Project{Stack: detect.Deno},
			[]string{"check", "test"}},
		{"gleam", detect.Project{Stack: detect.Gleam},
			[]string{"build", "test"}},
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

func TestCppCmakeCommands(t *testing.T) {
	p := detect.Project{Stack: detect.Cpp, BuildTool: detect.ToolCMake}
	checks := checksForProject(p)
	if checks[0].cmd != "cmake" {
		t.Errorf("build cmd = %q, want cmake", checks[0].cmd)
	}
	if checks[1].cmd != "ctest" {
		t.Errorf("test cmd = %q, want ctest", checks[1].cmd)
	}
}

func TestHaskellStackCommands(t *testing.T) {
	p := detect.Project{Stack: detect.Haskell, BuildTool: detect.ToolStack}
	checks := checksForProject(p)
	if checks[0].cmd != "stack" {
		t.Errorf("build cmd = %q, want stack", checks[0].cmd)
	}
}

func TestHaskellCabalCommands(t *testing.T) {
	p := detect.Project{Stack: detect.Haskell, BuildTool: detect.ToolCabal}
	checks := checksForProject(p)
	if checks[0].cmd != "cabal" {
		t.Errorf("build cmd = %q, want cabal", checks[0].cmd)
	}
}
