package config

// Default returns a default pipeline with common checks.
func Default() *Pipeline {
	return &Pipeline{
		On: []string{"push", "pull_request"},
		Checks: []Check{
			{Name: "build"},
			{Name: "test"},
			{Name: "lint"},
		},
	}
}

// DefaultWithStages returns a pipeline with proper stages.
func DefaultWithStages(branch string) *Pipeline {
	stages := []Stage{
		{
			Name:   "install",
			Checks: []Check{{Name: "install"}},
		},
		{
			Name:      "check",
			DependsOn: []string{"install"},
			Parallel:  true,
			Checks: []Check{
				{Name: "build"},
				{Name: "test"},
				{Name: "lint"},
			},
		},
	}

	return &Pipeline{
		On:     []string{"push", "pull_request"},
		Stages: stages,
	}
}

// HasStages returns true if the pipeline uses stages.
func (p *Pipeline) HasStages() bool {
	return len(p.Stages) > 0
}

// FlatChecks returns all checks from stages or top-level.
func (p *Pipeline) FlatChecks() []Check {
	if !p.HasStages() {
		return p.Checks
	}
	var all []Check
	for _, s := range p.Stages {
		all = append(all, s.Checks...)
	}
	return all
}

// ShouldRunStage checks if a stage should run on the given branch.
func ShouldRunStage(stage Stage, branch string) bool {
	if len(stage.OnlyOn) == 0 {
		return true
	}
	for _, b := range stage.OnlyOn {
		if b == branch || b == "*" {
			return true
		}
	}
	return false
}
