package runner

import (
	"context"
	"fmt"
	"os/exec"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
)

// ExecuteInDocker runs all checks inside a Docker container.
// Used when host OS differs from target (e.g. Windows → Linux).
func ExecuteInDocker(
	ctx context.Context,
	root string,
	projects []detect.Project,
	opts DockerOpts,
) *Run {
	run := &Run{Started: time.Now()}

	for _, p := range projects {
		dir := root
		if p.Dir != "." {
			dir = root + "/" + p.Dir
		}
		image := opts.Image
		if image == "" {
			image = DefaultImage(p.Stack)
		}
		cmds := checksForProject(p, dir)
		for _, c := range cmds {
			r := runDockerCmd(ctx, c.name, dir, image, opts, c.cmd, c.args...)
			run.Results = append(run.Results, r)
		}
	}

	run.Elapsed = time.Since(run.Started)
	run.Passed = allPassed(run.Results)
	return run
}

func runDockerCmd(
	ctx context.Context,
	name, dir, image string,
	opts DockerOpts,
	cmd string,
	args ...string,
) Result {
	start := time.Now()

	dockerArgs := []string{
		"run", "--rm",
		"-v", fmt.Sprintf("%s:/workspace", dir),
		"-w", "/workspace",
	}
	if opts.Platform != "" {
		dockerArgs = append(dockerArgs, "--platform", opts.Platform)
	}
	for _, v := range opts.Volumes {
		dockerArgs = append(dockerArgs, "-v", v)
	}
	dockerArgs = append(dockerArgs, image, cmd)
	dockerArgs = append(dockerArgs, args...)

	c := exec.CommandContext(ctx, "docker", dockerArgs...)
	out, err := c.CombinedOutput()

	return Result{
		Check:    fmt.Sprintf("docker/%s/%s", image, name),
		Passed:   err == nil,
		Output:   truncate(string(out), 2000),
		Duration: time.Since(start),
	}
}
