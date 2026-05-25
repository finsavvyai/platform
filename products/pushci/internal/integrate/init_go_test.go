package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitGoAPI(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"go.mod":       "module example.com/api\n\ngo 1.22\n",
		"main.go":      "package main\nfunc main() {}\n",
		"main_test.go": "package main\nimport \"testing\"\nfunc TestX(t *testing.T) {}\n",
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 {
		t.Fatal("no projects detected")
	}
	if projects[0].Stack != detect.Go {
		t.Fatalf("stack = %s, want go", projects[0].Stack)
	}

	for _, name := range []string{"install", "build", "test", "lint"} {
		if hasStage(pipe, name) == nil {
			t.Errorf("missing stage %q", name)
		}
	}
	if s := hasStage(pipe, "build"); s != nil && !hasCheck(s, "go-build") {
		t.Error("build stage missing go-build check")
	}
	if s := hasStage(pipe, "test"); s != nil && !hasCheck(s, "go-test") {
		t.Error("test stage missing go-test check")
	}
	if s := hasStage(pipe, "lint"); s != nil && !hasCheck(s, "go-vet") {
		t.Error("lint stage missing go-vet check")
	}
}

func TestInitGoLibrary(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"go.mod":           "module example.com/mathlib\n\ngo 1.22\n",
		"pkg/math.go":      "package math\nfunc Add(a, b int) int { return a + b }\n",
		"pkg/math_test.go": "package math\nimport \"testing\"\nfunc TestAdd(t *testing.T) {}\n",
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 {
		t.Fatal("no projects detected")
	}
	if projects[0].Stack != detect.Go {
		t.Fatalf("stack = %s, want go", projects[0].Stack)
	}
	if s := hasStage(pipe, "test"); s == nil {
		t.Error("missing test stage")
	} else if checkRun(s, "go-test") != "go test ./..." {
		t.Errorf("go-test run = %q", checkRun(s, "go-test"))
	}
}

func TestInitGoMonorepo(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"go.mod":                "module example.com/mono\n\ngo 1.22\n",
		"services/auth/auth.go": "package auth\n",
		"services/api/api.go":   "package api\n",
	})

	_, projects := scanAndBuild(dir)
	if len(projects) == 0 {
		t.Fatal("no projects detected")
	}
	found := false
	for _, p := range projects {
		if p.Stack == detect.Go {
			found = true
		}
	}
	if !found {
		t.Error("go stack not detected in monorepo layout")
	}
}
