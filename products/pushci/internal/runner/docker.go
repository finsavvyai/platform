package runner

import (
	"os/exec"
	"runtime"
	"strings"

	"github.com/finsavvyai/pushci/internal/detect"
)

// DockerMode controls how Docker is used for pipeline execution.
type DockerMode string

const (
	// DockerOff runs checks natively on the host.
	DockerOff DockerMode = ""
	// DockerAuto uses Docker when host OS differs from target.
	DockerAuto DockerMode = "auto"
	// DockerAlways forces Docker for all checks.
	DockerAlways DockerMode = "always"
)

// DockerOpts configures Docker-based pipeline execution.
type DockerOpts struct {
	Mode     DockerMode
	Image    string // e.g. "node:20-slim", "golang:1.22-alpine"
	Platform string // target platform, e.g. "linux/amd64"
	Volumes  []string
}

// NeedsDocker returns true if Docker should be used given the
// host OS and the target deployment platform.
func NeedsDocker(opts DockerOpts) bool {
	if opts.Mode == DockerAlways {
		return true
	}
	if opts.Mode == DockerOff {
		return false
	}
	target := opts.Platform
	if target == "" {
		target = "linux/amd64"
	}
	hostOS := runtime.GOOS
	targetOS := strings.Split(target, "/")[0]
	return hostOS != targetOS
}

// DefaultImage returns a sensible Docker image for a stack.
func DefaultImage(stack detect.Stack) string {
	images := map[detect.Stack]string{
		detect.Node:   "node:20-slim",
		detect.Go:     "golang:1.22-alpine",
		detect.Python: "python:3.12-slim",
		detect.Rust:   "rust:1.77-slim",
		detect.Java:   "eclipse-temurin:21-jdk",
		detect.Ruby:   "ruby:3.3-slim",
		detect.PHP:    "php:8.3-cli",
		detect.Deno:   "denoland/deno:latest",
		detect.Elixir: "elixir:1.16-slim",
		detect.Dart:   "dart:stable",
	}
	if img, ok := images[stack]; ok {
		return img
	}
	return "ubuntu:24.04"
}

// DockerAvailable checks if Docker is installed and responsive.
func DockerAvailable() bool {
	out, err := exec.Command("docker", "info").CombinedOutput()
	return err == nil && !strings.Contains(string(out), "Cannot connect")
}

func allPassed(results []Result) bool {
	for _, r := range results {
		if !r.Passed {
			return false
		}
	}
	return true
}
