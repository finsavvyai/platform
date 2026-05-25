package config

// legacyDeploy is the pre-1.4.4 mapping-form shape. Only used as
// a parsing intermediate inside Pipeline.UnmarshalYAML — external
// code reads Pipeline.Deploys, which is produced by flattening
// this legacy shape through toTargets().
type legacyDeploy struct {
	Trigger      string            `yaml:"trigger,omitempty"`
	Run          string            `yaml:"run,omitempty"`
	OnlyOn       []string          `yaml:"only_on,omitempty"`
	Env          map[string]string `yaml:"env,omitempty"`
	Environments []legacyEnv       `yaml:"environments,omitempty"`
}

type legacyEnv struct {
	Name    string            `yaml:"name"`
	Run     string            `yaml:"run"`
	OnlyOn  []string          `yaml:"only_on,omitempty"`
	Env     map[string]string `yaml:"env,omitempty"`
	Approve bool              `yaml:"approve,omitempty"`
}

// toTargets flattens a legacy deploy block into DeployTargets,
// preserving the single-target and per-environment-run shapes.
// Each environment inherits trigger/only_on from the outer block
// so the old behavior stays byte-identical for existing users.
func (d legacyDeploy) toTargets() []DeployTarget {
	if len(d.Environments) == 0 {
		return []DeployTarget{{
			Name:    "deploy",
			Trigger: d.Trigger,
			Run:     d.Run,
			OnlyOn:  d.OnlyOn,
			Env:     d.Env,
		}}
	}
	out := make([]DeployTarget, 0, len(d.Environments))
	for _, env := range d.Environments {
		only := env.OnlyOn
		if len(only) == 0 {
			only = d.OnlyOn
		}
		out = append(out, DeployTarget{
			Name:    env.Name,
			Trigger: d.Trigger,
			Run:     env.Run,
			OnlyOn:  only,
			Env:     env.Env,
			Approve: env.Approve,
		})
	}
	return out
}
