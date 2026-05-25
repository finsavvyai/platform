package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitKotlin(t *testing.T) {
	dir := setupRepo(t, map[string]string{"main.kt": "fun main() { println(\"hello\") }\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Kotlin {
		t.Fatalf("expected kotlin, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "kotlin-build", "kotlinc src/*.kt -include-runtime -d app.jar"},
		{"test", "kotlin-test", "kotlin -cp app.jar MainKt"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitLua(t *testing.T) {
	dir := setupRepo(t, map[string]string{"init.lua": "print('hello')\n", ".busted": "{}\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Lua {
		t.Fatalf("expected lua, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"test", "lua-test", "busted"},
		{"lint", "lua-lint", "luacheck ."},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitPerl(t *testing.T) {
	dir := setupRepo(t, map[string]string{"cpanfile": "requires 'Moose';\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Perl {
		t.Fatalf("expected perl, got %+v", projects)
	}
	s := hasStage(pipe, "test")
	if s == nil {
		t.Error("missing test stage")
	} else if got := checkRun(s, "perl-test"); got != "prove -l t/" {
		t.Errorf("perl-test run = %q, want %q", got, "prove -l t/")
	}
}
