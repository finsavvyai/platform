package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

// NotifyConfig holds notification webhook/email settings.
type NotifyConfig struct {
	Slack    string `yaml:"slack,omitempty"`
	Discord  string `yaml:"discord,omitempty"`
	Email    string `yaml:"email,omitempty"`
	Telegram string `yaml:"telegram,omitempty"`
	Webhook  string `yaml:"webhook,omitempty"`
}

// Pipeline represents a pushci.yml configuration. The `Deploys`
// field is populated by a custom UnmarshalYAML (deploy_unmarshal.go)
// that accepts both the legacy mapping form and the v1.4.4 list
// form of the `deploy:` block, so external code only needs to
// iterate Deploys.
type Pipeline struct {
	On      []string       `yaml:"on"`
	Stages  []Stage        `yaml:"stages,omitempty"`
	Checks  []Check        `yaml:"checks,omitempty"`
	Deploys []DeployTarget `yaml:"deploy,omitempty"`
	Notify  *NotifyConfig  `yaml:"notify,omitempty"`
}

// Stage is a named group of checks that run together.
type Stage struct {
	Name      string            `yaml:"name"`
	Dir       string            `yaml:"dir,omitempty"`
	Checks    []Check           `yaml:"checks"`
	DependsOn []string          `yaml:"depends_on,omitempty"`
	OnlyOn    []string          `yaml:"only_on,omitempty"`
	Parallel  bool              `yaml:"parallel,omitempty"`
	Env       map[string]string `yaml:"env,omitempty"`
	// Pipeline operators
	OnSuccess  bool     `yaml:"on_success,omitempty"`
	OnFailure  []string `yaml:"on_failure,omitempty"`
	Retry      int      `yaml:"retry,omitempty"`
	RetryUntil string   `yaml:"retry_until,omitempty"`
	Timeout    string   `yaml:"timeout,omitempty"`
	Approve    bool     `yaml:"approve,omitempty"`
}

// Check is a single CI check step.
type Check struct {
	Name   string `yaml:"name,omitempty"`
	Run    string `yaml:"run,omitempty"`
	Docker string `yaml:"docker,omitempty"`
	Limit  int    `yaml:"line-limit,omitempty"`
	OnFail string `yaml:"on_fail,omitempty"`
	Retry  int    `yaml:"retry,omitempty"`
	If     string `yaml:"if,omitempty"`
}

// The old `Deploy` and `Environment` structs that used to live
// here were removed in v1.4.4 when the deploy schema was unified
// around DeployTarget. The pre-1.4.4 mapping form is still parsed
// via deploy_unmarshal.go → legacyDeploy → toTargets, so existing
// pushci.yml files with the old shape load unchanged.

// UnmarshalYAML allows checks to be strings or objects.
func (c *Check) UnmarshalYAML(value *yaml.Node) error {
	if value.Kind == yaml.ScalarNode {
		c.Name = value.Value
		return nil
	}
	type raw Check
	return value.Decode((*raw)(c))
}

// Load reads a pushci.yml file.
func Load(path string) (*Pipeline, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var p Pipeline
	if err := yaml.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	return &p, nil
}
