package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitClojure(t *testing.T) {
	dir := setupRepo(t, map[string]string{"project.clj": `(defproject myapp "0.1.0")`})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Clojure {
		t.Fatalf("expected clojure, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"install", "lein-install", "lein deps"},
		{"test", "lein-test", "lein test"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitGradle(t *testing.T) {
	dir := setupRepo(t, map[string]string{"build.gradle": "apply plugin: 'java'\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Java {
		t.Fatalf("expected java, got %+v", projects)
	}
	found := false
	for _, p := range projects {
		if p.BuildTool == detect.ToolGradle {
			found = true
		}
	}
	if !found {
		t.Error("expected gradle build tool")
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "gradle-build", "./gradlew build"},
		{"test", "gradle-test", "./gradlew test"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitGradleKotlin(t *testing.T) {
	dir := setupRepo(t, map[string]string{"build.gradle.kts": `plugins { java }`})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Java {
		t.Fatalf("expected java, got %+v", projects)
	}
	if s := hasStage(pipe, "build"); s == nil {
		t.Error("missing build stage")
	}
	if s := hasStage(pipe, "test"); s == nil {
		t.Error("missing test stage")
	}
}

func TestInitMavenVsGradle(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"pom.xml":      `<project><modelVersion>4.0.0</modelVersion></project>`,
		"build.gradle": "apply plugin: 'java'\n",
	})
	_, projects := scanAndBuild(dir)
	if len(projects) == 0 {
		t.Fatal("no projects detected")
	}
	hasMaven, hasGradle := false, false
	for _, p := range projects {
		if p.BuildTool == detect.ToolMaven {
			hasMaven = true
		}
		if p.BuildTool == detect.ToolGradle {
			hasGradle = true
		}
	}
	if !hasMaven && !hasGradle {
		t.Error("expected at least one java build tool detected")
	}
}
