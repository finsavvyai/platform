package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitPythonFastAPI(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"requirements.txt": "fastapi==0.110.0\nuvicorn\n",
		"main.py":          "from fastapi import FastAPI\napp = FastAPI()\n",
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 {
		t.Fatal("no projects detected")
	}
	if projects[0].Stack != detect.Python {
		t.Fatalf("stack = %s, want python", projects[0].Stack)
	}
	if projects[0].Framework != "fastapi" {
		t.Errorf("framework = %q, want fastapi", projects[0].Framework)
	}
	// No build stage for plain Python
	if s := hasStage(pipe, "build"); s != nil && hasCheck(s, "py-build") {
		t.Error("fastapi project should not have py-build")
	}
	if s := hasStage(pipe, "test"); s != nil && !hasCheck(s, "pytest") {
		t.Error("missing pytest check")
	}
	if s := hasStage(pipe, "lint"); s != nil {
		if checkRun(s, "py-lint") != "python -m compileall -q ." {
			t.Errorf("lint = %q, want compileall", checkRun(s, "py-lint"))
		}
	}
}

func TestInitPythonDjango(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"requirements.txt": "django==5.0\n",
		"manage.py":        "#!/usr/bin/env python\nimport django\n",
	})

	pipe, projects := scanAndBuild(dir)
	found := false
	for _, p := range projects {
		if p.Stack == detect.Python && p.Framework == "django" {
			found = true
		}
	}
	if !found {
		t.Fatal("django framework not detected")
	}
	if s := hasStage(pipe, "test"); s != nil {
		if checkRun(s, "django-test") != "python manage.py test" {
			t.Errorf("django test = %q", checkRun(s, "django-test"))
		}
	}
}

func TestInitPythonWithBuild(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"pyproject.toml": "[build-system]\nrequires = [\"setuptools\"]\n",
	})

	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "build"); s == nil || !hasCheck(s, "py-build") {
		t.Error("py-build check should exist for pyproject with build-system")
	}
}

func TestInitPythonWithRuff(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"requirements.txt": "flask\nruff\n",
	})

	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "lint"); s == nil {
		t.Fatal("lint stage missing")
	} else if checkRun(s, "py-lint") != "ruff check ." {
		t.Errorf("lint = %q, want ruff check .", checkRun(s, "py-lint"))
	}
}
