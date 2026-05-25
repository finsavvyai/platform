package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

// NotifyConfig holds notification webhook/email settings.
type NotifyConfig struct {
	Slack   string `yaml:"slack,omitempty"`
	Discord string `yaml:"discord,omitempty"`
	Email   string `yaml:"email,omitempty"`
}

// Pipeline represents a pushci.yml configuration.
type Pipeline struct {
	On      []string      `yaml:"on"`
	Checks  []Check       `yaml:"checks"`
	Deploy  *Deploy       `yaml:"deploy,omitempty"`
	Notify  *NotifyConfig `yaml:"notify,omitempty"`
}

// Check is a single CI check step.
type Check struct {
	Name   string `yaml:"name,omitempty"`
	Run    string `yaml:"run,omitempty"`
	Docker string `yaml:"docker,omitempty"`
	Limit  int    `yaml:"line-limit,omitempty"`
}

// Deploy configures auto-deployment.
type Deploy struct {
	Trigger string `yaml:"trigger"`
	Run     string `yaml:"run"`
}

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

// Default returns a default pipeline with common checks.
func Default() *Pipeline {
	return &Pipeline{
		On:     []string{"push", "pull_request"},
		Checks: []Check{{Name: "build"}, {Name: "test"}, {Name: "lint"}},
	}
}
