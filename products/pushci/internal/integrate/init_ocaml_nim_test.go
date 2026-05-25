package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitOCaml(t *testing.T) {
	dir := setupRepo(t, map[string]string{"dune-project": "(lang dune 3.0)\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.OCaml {
		t.Fatalf("expected ocaml, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "dune-build", "dune build"},
		{"test", "dune-test", "dune runtest"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitNim(t *testing.T) {
	dir := setupRepo(t, map[string]string{"myapp.nimble": "version = \"0.1.0\"\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Nim {
		t.Fatalf("expected nim, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "nimble-build", "nimble build"},
		{"test", "nimble-test", "nimble test"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitCrystal(t *testing.T) {
	dir := setupRepo(t, map[string]string{"shard.yml": "name: myapp\nversion: 0.1.0\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Crystal {
		t.Fatalf("expected crystal, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "crystal-build", "shards build"},
		{"test", "crystal-test", "crystal spec"},
		{"lint", "crystal-format", "crystal tool format --check"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitErlang(t *testing.T) {
	dir := setupRepo(t, map[string]string{"rebar.config": "{deps, []}.\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Erlang {
		t.Fatalf("expected erlang, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "rebar3-compile", "rebar3 compile"},
		{"test", "rebar3-eunit", "rebar3 eunit"},
		{"lint", "rebar3-dialyzer", "rebar3 dialyzer"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitVlang(t *testing.T) {
	dir := setupRepo(t, map[string]string{"v.mod": "Module{name: 'myapp'}\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Vlang {
		t.Fatalf("expected vlang, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "v-build", "v ."},
		{"test", "v-test", "v test ."},
		{"lint", "v-fmt", "v fmt -verify ."},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}
