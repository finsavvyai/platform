package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitNodeWithAllScripts(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json": `{
			"name": "myapp",
			"scripts": {
				"build": "tsc",
				"test": "jest",
				"lint": "eslint ."
			}
		}`,
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 {
		t.Fatal("no projects detected")
	}
	if projects[0].Stack != detect.Node {
		t.Fatalf("stack = %s, want node", projects[0].Stack)
	}

	for _, name := range []string{"install", "build", "test", "lint"} {
		if hasStage(pipe, name) == nil {
			t.Errorf("missing stage %q", name)
		}
	}
	if s := hasStage(pipe, "build"); s != nil && checkRun(s, "build") != "npm run build" {
		t.Errorf("build run = %q", checkRun(s, "build"))
	}
	if s := hasStage(pipe, "test"); s != nil && checkRun(s, "test") != "npm test" {
		t.Errorf("test run = %q", checkRun(s, "test"))
	}
}

func TestInitNodeWithoutBuild(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json": `{"name":"lib","scripts":{"test":"jest"}}`,
	})

	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "build"); s != nil {
		t.Error("build stage should not exist when no build script")
	}
	if s := hasStage(pipe, "test"); s == nil {
		t.Error("test stage should exist")
	}
}

func TestInitNodeDefaultTest(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json": `{
			"name": "stub",
			"scripts": {
				"test": "echo \"Error: no test specified\" && exit 1"
			}
		}`,
	})

	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "test"); s != nil {
		for _, c := range s.Checks {
			if c.Name == "test" {
				t.Error("default npm test script should be skipped")
			}
		}
	}
}

func TestInitNodeVite(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json":   `{"name":"app","dependencies":{"vite":"^5.0.0"},"scripts":{"build":"vite build","test":"vitest"}}`,
		"vite.config.ts": "export default {}",
	})

	_, projects := scanAndBuild(dir)
	found := false
	for _, p := range projects {
		if p.Stack == detect.Node && p.Framework == "vite" {
			found = true
		}
	}
	if !found {
		t.Error("vite framework not detected")
	}
}
