package actions

import (
	"runtime"
	"strings"
	"testing"
)

func TestRunOptions_Validate_AcceptsZeroValue(t *testing.T) {
	if err := (RunOptions{}).Validate(); err != nil {
		t.Fatalf("zero options should validate, got: %v", err)
	}
}

func TestRunOptions_Validate_AcceptsValidPayload(t *testing.T) {
	opts := RunOptions{
		Event:   "push",
		Job:     "build",
		Secrets: map[string]string{"GITHUB_TOKEN": "abc"},
		Env:     map[string]string{"NODE_ENV": "test"},
		Inputs:  map[string]string{"version": "1.2.3"},
	}
	if err := opts.Validate(); err != nil {
		t.Fatalf("expected valid, got: %v", err)
	}
}

func TestRunOptions_Validate_RejectsBadKeys(t *testing.T) {
	cases := []struct {
		name string
		opts RunOptions
		want string
	}{
		{
			"empty secret key",
			RunOptions{Secrets: map[string]string{"": "v"}},
			"empty",
		},
		{
			"secret key with equals",
			RunOptions{Secrets: map[string]string{"K=Y": "v"}},
			"invalid",
		},
		{
			"secret key with whitespace",
			RunOptions{Secrets: map[string]string{"key with space": "v"}},
			"invalid",
		},
		{
			"env key with equals",
			RunOptions{Env: map[string]string{"BAD=KEY": "v"}},
			"invalid",
		},
		{
			"input key with newline",
			RunOptions{Inputs: map[string]string{"k\nbad": "v"}},
			"invalid",
		},
		{
			"event with whitespace",
			RunOptions{Event: "push event"},
			"whitespace",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.opts.Validate()
			if err == nil {
				t.Fatalf("expected validation error containing %q", tc.want)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error %q does not contain %q", err.Error(), tc.want)
			}
		})
	}
}

func TestRunOptions_ResolvedArchitecture_RespectsExplicit(t *testing.T) {
	opts := RunOptions{ContainerArchitecture: "linux/arm64"}
	if got := opts.resolvedArchitecture(); got != "linux/arm64" {
		t.Fatalf("expected explicit arch to win, got %q", got)
	}
}

func TestRunOptions_ResolvedArchitecture_AppleSiliconDefault(t *testing.T) {
	if runtime.GOOS != "darwin" || runtime.GOARCH != "arm64" {
		t.Skip("only meaningful on darwin/arm64")
	}
	got := (RunOptions{}).resolvedArchitecture()
	if got != "linux/amd64" {
		t.Fatalf("Apple Silicon should default to linux/amd64, got %q", got)
	}
}

func TestRunOptions_ResolvedPlatforms_MergesOverrides(t *testing.T) {
	opts := RunOptions{
		Platforms: map[string]string{
			"ubuntu-latest": "my-org/custom-runner:latest",
			"my-runner":     "my-org/dedicated:1.0",
		},
	}
	got := opts.resolvedPlatforms()
	if got["ubuntu-latest"] != "my-org/custom-runner:latest" {
		t.Errorf("user override should win for ubuntu-latest, got %q", got["ubuntu-latest"])
	}
	if got["my-runner"] != "my-org/dedicated:1.0" {
		t.Errorf("custom runner missing, got %q", got["my-runner"])
	}
	// Defaults still present for other runners.
	if _, ok := got["ubuntu-22.04"]; !ok {
		t.Error("default ubuntu-22.04 should still be present")
	}
}

func TestDefaultPlatformImages_CoversCommonRunners(t *testing.T) {
	required := []string{"ubuntu-latest", "ubuntu-22.04", "ubuntu-20.04"}
	for _, runner := range required {
		if _, ok := DefaultPlatformImages[runner]; !ok {
			t.Errorf("missing default mapping for %s", runner)
		}
	}
}
