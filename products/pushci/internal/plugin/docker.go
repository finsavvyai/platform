package plugin

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// DockerPlugin runs a CI check inside a Docker container.
// Configured in pushci.yml:
//
//	checks:
//	  - name: security-scan
//	    docker: ghcr.io/aquasec/trivy:latest
type DockerPlugin struct {
	PluginName string
	Image      string
	Command    string
}

// Name returns the plugin name.
func (d *DockerPlugin) Name() string { return d.PluginName }

// Run pulls and executes the Docker image against the directory.
func (d *DockerPlugin) Run(ctx context.Context, dir string) (*Result, error) {
	start := time.Now()

	args := d.buildArgs(dir)
	c := exec.CommandContext(ctx, "docker", args...)
	c.Dir = dir

	out, err := c.CombinedOutput()
	duration := time.Since(start)

	if err != nil {
		return &Result{
			Passed:   false,
			Output:   string(out),
			Duration: duration,
		}, nil
	}

	return &Result{
		Passed:   true,
		Output:   string(out),
		Duration: duration,
	}, nil
}

// buildArgs constructs docker run arguments.
func (d *DockerPlugin) buildArgs(dir string) []string {
	args := []string{
		"run", "--rm",
		"-v", fmt.Sprintf("%s:/workspace", dir),
		"-w", "/workspace",
		d.Image,
	}

	if d.Command != "" {
		parts := strings.Fields(d.Command)
		args = append(args, parts...)
	}

	return args
}
