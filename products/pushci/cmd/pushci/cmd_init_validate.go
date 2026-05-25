package main

import "github.com/finsavvyai/pushci/internal/config"

// validateDependsOn removes depends_on references to stages that don't exist.
func validateDependsOn(stages []config.Stage) []config.Stage {
	names := map[string]bool{}
	for _, s := range stages {
		names[s.Name] = true
	}
	for i, s := range stages {
		var valid []string
		for _, dep := range s.DependsOn {
			if names[dep] {
				valid = append(valid, dep)
			}
		}
		stages[i].DependsOn = valid
	}
	return stages
}
