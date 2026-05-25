package runner

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestNeedsDocker(t *testing.T) {
	tests := []struct {
		name string
		opts DockerOpts
		want bool
	}{
		{"off mode", DockerOpts{Mode: DockerOff}, false},
		{"always mode", DockerOpts{Mode: DockerAlways}, true},
		{"auto same os", DockerOpts{Mode: DockerAuto, Platform: "darwin/arm64"}, false},
		{"auto cross platform", DockerOpts{Mode: DockerAuto, Platform: "linux/amd64"}, true},
	}
	// On macOS (darwin), linux target should need Docker.
	// On Linux, linux target should not.
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NeedsDocker(tt.opts)
			if tt.opts.Mode == DockerOff && got {
				t.Error("off mode should not need Docker")
			}
			if tt.opts.Mode == DockerAlways && !got {
				t.Error("always mode should need Docker")
			}
		})
	}
}

func TestDefaultImage(t *testing.T) {
	tests := []struct {
		stack detect.Stack
		want  string
	}{
		{detect.Node, "node:20-slim"},
		{detect.Go, "golang:1.22-alpine"},
		{detect.Python, "python:3.12-slim"},
		{detect.Rust, "rust:1.77-slim"},
		{detect.Java, "eclipse-temurin:21-jdk"},
		{detect.Ruby, "ruby:3.3-slim"},
	}
	for _, tt := range tests {
		t.Run(string(tt.stack), func(t *testing.T) {
			got := DefaultImage(tt.stack)
			if got != tt.want {
				t.Errorf("DefaultImage(%s) = %q, want %q", tt.stack, got, tt.want)
			}
		})
	}
}

func TestDefaultImageFallback(t *testing.T) {
	got := DefaultImage(detect.Stack("unknown"))
	if got != "ubuntu:24.04" {
		t.Errorf("fallback = %q, want ubuntu:24.04", got)
	}
}

func TestAllPassed(t *testing.T) {
	pass := []Result{{Passed: true}, {Passed: true}}
	if !allPassed(pass) {
		t.Error("expected all passed")
	}
	fail := []Result{{Passed: true}, {Passed: false}}
	if allPassed(fail) {
		t.Error("expected not all passed")
	}
	if !allPassed(nil) {
		t.Error("empty should pass")
	}
}
