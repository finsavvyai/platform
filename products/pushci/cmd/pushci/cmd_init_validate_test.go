package main

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/config"
)

func TestValidateDependsOn_RemovesMissing(t *testing.T) {
	stages := []config.Stage{
		{Name: "build", DependsOn: []string{"install"}},
		{Name: "test", DependsOn: []string{"install"}},
	}
	result := validateDependsOn(stages)
	for _, s := range result {
		if len(s.DependsOn) != 0 {
			t.Errorf("stage %q: expected empty depends_on, got %v", s.Name, s.DependsOn)
		}
	}
}

func TestValidateDependsOn_KeepsValid(t *testing.T) {
	stages := []config.Stage{
		{Name: "install"},
		{Name: "build", DependsOn: []string{"install"}},
		{Name: "test", DependsOn: []string{"install"}},
	}
	result := validateDependsOn(stages)
	if len(result[1].DependsOn) != 1 || result[1].DependsOn[0] != "install" {
		t.Errorf("build: expected [install], got %v", result[1].DependsOn)
	}
	if len(result[2].DependsOn) != 1 || result[2].DependsOn[0] != "install" {
		t.Errorf("test: expected [install], got %v", result[2].DependsOn)
	}
}

func TestValidateDependsOn_MixedDeps(t *testing.T) {
	stages := []config.Stage{
		{Name: "install"},
		{Name: "build", DependsOn: []string{"install", "missing"}},
	}
	result := validateDependsOn(stages)
	if len(result[1].DependsOn) != 1 || result[1].DependsOn[0] != "install" {
		t.Errorf("expected [install], got %v", result[1].DependsOn)
	}
}
