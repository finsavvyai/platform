package config

import "time"

// DeployTarget is the v1.4.4 deploy shape. The old single-mapping
// `deploy: {trigger:..., run:..., environments: [...]}` form is
// flattened into a slice of these at UnmarshalYAML time, and the
// new list form `deploy: [{name:..., run:..., verify:...}, ...]`
// parses into it directly. Consumers only read Pipeline.Deploys.
type DeployTarget struct {
	Name      string            `yaml:"name,omitempty"`
	Trigger   string            `yaml:"trigger,omitempty"`
	Run       string            `yaml:"run,omitempty"`
	Path      string            `yaml:"path,omitempty"`
	OnlyOn    []string          `yaml:"only_on,omitempty"`
	DependsOn []string          `yaml:"depends_on,omitempty"`
	Env       map[string]string `yaml:"env,omitempty"`
	Approve   bool              `yaml:"approve,omitempty"`
	Timeout   string            `yaml:"timeout,omitempty"`
	Verify    *VerifyConfig     `yaml:"verify,omitempty"`
}

// VerifyConfig describes a post-deploy health check. The runner
// polls URL up to Retries times waiting for Expect to match — a
// numeric status code like "200" is compared against the response
// status, anything else is matched as a regex against the body.
// Interval is parsed as a Go duration ("10s", "500ms").
type VerifyConfig struct {
	URL      string `yaml:"url"`
	Expect   string `yaml:"expect,omitempty"`
	Retries  int    `yaml:"retries,omitempty"`
	Interval string `yaml:"interval,omitempty"`
}

// IntervalDuration parses Interval into a time.Duration, defaulting
// to 5s when empty or invalid. Keeps the happy path terse for
// callers in the runner.
func (v *VerifyConfig) IntervalDuration() time.Duration {
	if v == nil || v.Interval == "" {
		return 5 * time.Second
	}
	d, err := time.ParseDuration(v.Interval)
	if err != nil || d <= 0 {
		return 5 * time.Second
	}
	return d
}

// RetryCount returns the effective retry count (minimum 1 so a
// zero-value verify block still gets one attempt).
func (v *VerifyConfig) RetryCount() int {
	if v == nil || v.Retries <= 0 {
		return 1
	}
	return v.Retries
}
