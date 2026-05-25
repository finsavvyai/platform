package plugin

import (
	"context"
	"os/exec"
	"strings"
	"time"
)

// ScriptPlugin runs a user-defined shell command as a CI check.
// Configured in pushci.yml:
//
//	checks:
//	  - name: my-check
//	    run: ./scripts/custom-check.sh
type ScriptPlugin struct {
	PluginName string
	Command    string
	Args       []string
}

// Name returns the plugin name.
func (s *ScriptPlugin) Name() string { return s.PluginName }

// Run executes the shell command in the given directory.
func (s *ScriptPlugin) Run(ctx context.Context, dir string) (*Result, error) {
	start := time.Now()

	name, args := s.parseCommand()
	c := exec.CommandContext(ctx, name, args...)
	c.Dir = dir

	out, err := c.CombinedOutput()
	d := time.Since(start)

	if err != nil {
		return &Result{
			Passed:   false,
			Output:   string(out),
			Duration: d,
		}, nil
	}

	return &Result{
		Passed:   true,
		Output:   string(out),
		Duration: d,
	}, nil
}

// parseCommand splits the command string into executable and args.
func (s *ScriptPlugin) parseCommand() (string, []string) {
	if len(s.Args) > 0 {
		return s.Command, s.Args
	}

	parts := strings.Fields(s.Command)
	if len(parts) == 0 {
		return s.Command, nil
	}
	if len(parts) == 1 {
		return parts[0], nil
	}
	return parts[0], parts[1:]
}
