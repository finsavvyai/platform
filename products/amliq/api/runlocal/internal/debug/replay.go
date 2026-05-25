package debug

import (
	"fmt"
	"os"
	"os/exec"
)

// ReplayLocally re-executes all checks from a snapshot.
func ReplayLocally(s *Snapshot) error {
	for _, c := range s.Checks {
		if c.Command == "" {
			continue
		}
		cmd := exec.Command(c.Command, c.Args...)
		cmd.Dir = c.Dir
		cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("replay %s: %w", c.Name, err)
		}
	}
	return nil
}
