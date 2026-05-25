package main

import (
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/config"
)

func TestShouldRunDeployDuringRun(t *testing.T) {
	cases := []struct {
		name    string
		deploy  *config.DeployTarget
		force   bool
		want    bool
		skipFmt string
	}{
		{
			name:   "nil deploy returns false",
			deploy: nil,
			want:   false,
		},
		{
			name:   "empty trigger runs for backward compat",
			deploy: &config.DeployTarget{Run: "./deploy.sh"},
			want:   true,
		},
		{
			name:   "trigger: push skips on local run",
			deploy: &config.DeployTarget{Trigger: "push", Run: "./deploy.sh"},
			want:   false,
		},
		{
			name:   "trigger: push with force overrides",
			deploy: &config.DeployTarget{Trigger: "push", Run: "./deploy.sh"},
			force:  true,
			want:   true,
		},
		{
			name:   "trigger: manual skips on local run",
			deploy: &config.DeployTarget{Trigger: "manual", Run: "./deploy.sh"},
			want:   false,
		},
		{
			name:   "trigger: manual with force overrides",
			deploy: &config.DeployTarget{Trigger: "manual", Run: "./deploy.sh"},
			force:  true,
			want:   true,
		},
		{
			name:   "trigger: always runs without force",
			deploy: &config.DeployTarget{Trigger: "always", Run: "./deploy.sh"},
			want:   true,
		},
		{
			name:   "trigger matching is case-insensitive",
			deploy: &config.DeployTarget{Trigger: "PUSH", Run: "./deploy.sh"},
			want:   false,
		},
		{
			name:   "trigger matching trims whitespace",
			deploy: &config.DeployTarget{Trigger: "  push  ", Run: "./deploy.sh"},
			want:   false,
		},
		{
			name:   "unknown trigger defaults to run",
			deploy: &config.DeployTarget{Trigger: "wat", Run: "./deploy.sh"},
			want:   true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := shouldRunDeployDuringRun(tc.deploy, tc.force)
			if got != tc.want {
				t.Errorf("shouldRunDeployDuringRun(%+v, force=%v) = %v, want %v",
					tc.deploy, tc.force, got, tc.want)
			}
		})
	}
}

func TestDeploySkipReason(t *testing.T) {
	cases := map[string]struct {
		deploy *config.DeployTarget
		want   string
	}{
		"nil deploy": {
			deploy: nil,
			want:   "",
		},
		"trigger push mentions webhook": {
			deploy: &config.DeployTarget{Trigger: "push"},
			want:   "webhook",
		},
		"trigger manual mentions pushci deploy": {
			deploy: &config.DeployTarget{Trigger: "manual"},
			want:   "pushci deploy",
		},
		"empty trigger returns empty reason": {
			deploy: &config.DeployTarget{Run: "./x.sh"},
			want:   "",
		},
		"case insensitive": {
			deploy: &config.DeployTarget{Trigger: "Manual"},
			want:   "pushci deploy",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			got := deploySkipReason(tc.deploy)
			if tc.want == "" {
				if got != "" {
					t.Errorf("expected empty reason, got %q", got)
				}
				return
			}
			if !strings.Contains(got, tc.want) {
				t.Errorf("reason %q does not contain %q", got, tc.want)
			}
		})
	}
}
