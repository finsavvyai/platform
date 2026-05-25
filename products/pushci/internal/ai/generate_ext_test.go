package ai

import (
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestDefaultYAMLGoProject(t *testing.T) {
	projects := []detect.Project{
		{Stack: detect.Go, Dir: "."},
	}
	got := defaultYAML(projects)
	if !strings.Contains(got, "build") {
		t.Error("Go project default should include build")
	}
	if !strings.Contains(got, "test") {
		t.Error("Go project default should include test")
	}
}

func TestDefaultYAMLDockerOnly(t *testing.T) {
	projects := []detect.Project{
		{Stack: detect.Docker, Dir: "."},
	}
	got := defaultYAML(projects)
	if strings.Contains(got, "build") {
		t.Error("Docker-only project should not include build check")
	}
}

func TestDefaultYAMLMixedProjects(t *testing.T) {
	projects := []detect.Project{
		{Stack: detect.Docker, Dir: "."},
		{Stack: detect.Python, Dir: "api"},
	}
	got := defaultYAML(projects)
	if !strings.Contains(got, "build") {
		t.Error("mixed projects with non-Docker should include build")
	}
}

func TestDefaultYAMLEmpty(t *testing.T) {
	got := defaultYAML(nil)
	if !strings.Contains(got, "on:") {
		t.Error("empty projects should still have trigger")
	}
}
