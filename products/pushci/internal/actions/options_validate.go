package actions

import (
	"errors"
	"fmt"
	"runtime"
	"strings"
)

// Validate returns an error if the option set would produce an invalid
// act invocation. Callers should treat a validation error as a 4xx —
// the user supplied bad input.
func (o RunOptions) Validate() error {
	if o.Event != "" && strings.ContainsAny(o.Event, " \t\n") {
		return fmt.Errorf("event %q contains whitespace", o.Event)
	}
	for k := range o.Secrets {
		if k == "" {
			return errors.New("secret key cannot be empty")
		}
		if strings.ContainsAny(k, "= \t\n") {
			return fmt.Errorf("secret key %q contains invalid characters", k)
		}
	}
	for k := range o.Env {
		if strings.ContainsAny(k, "= \t\n") {
			return fmt.Errorf("env key %q contains invalid characters", k)
		}
	}
	for k := range o.Inputs {
		if strings.ContainsAny(k, "= \t\n") {
			return fmt.Errorf("input key %q contains invalid characters", k)
		}
	}
	for k, v := range o.LocalRepositories {
		if k == "" || v == "" {
			return errors.New("local repository mapping has empty key or path")
		}
		if strings.ContainsAny(k, " \t\n") || strings.ContainsAny(v, "\n") {
			return fmt.Errorf("local repository mapping %q=%q contains invalid whitespace", k, v)
		}
	}
	if strings.ContainsAny(o.GitHubToken, " \t\n") {
		return errors.New("github token contains whitespace")
	}
	return nil
}

// resolvedArchitecture returns the architecture flag act should receive.
// Apple Silicon defaults to linux/amd64 because most published actions
// only ship amd64 Docker images and would otherwise fail at pull time.
func (o RunOptions) resolvedArchitecture() string {
	if o.ContainerArchitecture != "" {
		return o.ContainerArchitecture
	}
	if runtime.GOOS == "darwin" && runtime.GOARCH == "arm64" {
		return "linux/amd64"
	}
	return ""
}

// resolvedPlatforms merges user overrides on top of DefaultPlatformImages.
// User overrides win on key collision.
func (o RunOptions) resolvedPlatforms() map[string]string {
	out := make(map[string]string, len(DefaultPlatformImages)+len(o.Platforms))
	for k, v := range DefaultPlatformImages {
		out[k] = v
	}
	for k, v := range o.Platforms {
		out[k] = v
	}
	return out
}
