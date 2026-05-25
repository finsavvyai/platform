package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitZig(t *testing.T) {
	dir := setupRepo(t, map[string]string{"build.zig": "const std = @import(\"std\");\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Zig {
		t.Fatalf("expected zig, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "zig-build", "zig build"},
		{"test", "zig-test", "zig build test"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitDeno(t *testing.T) {
	dir := setupRepo(t, map[string]string{"deno.json": `{"tasks":{"test":"deno test"}}`})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Deno {
		t.Fatalf("expected deno, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"test", "deno-test", "deno test"},
		{"lint", "deno-lint", "deno lint"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitHaskell(t *testing.T) {
	dir := setupRepo(t, map[string]string{"stack.yaml": "resolver: lts-21.25\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Haskell {
		t.Fatalf("expected haskell, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "stack-build", "stack build"},
		{"test", "stack-test", "stack test"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitGleam(t *testing.T) {
	dir := setupRepo(t, map[string]string{"gleam.toml": "name = \"myapp\"\nversion = \"1.0.0\"\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Gleam {
		t.Fatalf("expected gleam, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "gleam-build", "gleam build"},
		{"test", "gleam-test", "gleam test"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}
