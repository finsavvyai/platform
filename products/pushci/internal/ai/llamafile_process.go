package ai

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"syscall"
	"time"
)

// Start launches a llamafile server on the given port.
func Start(ctx context.Context, model ModelConfig, port int) (*exec.Cmd, error) {
	cmd := exec.CommandContext(ctx, model.Path,
		"--server", "--port", fmt.Sprintf("%d", port), "--nobrowser")
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start llamafile: %w", err)
	}
	return cmd, nil
}

// Stop gracefully shuts down a running llamafile process.
func Stop(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	if err := cmd.Process.Signal(syscall.SIGTERM); err != nil {
		return cmd.Process.Kill()
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case <-done:
		return nil
	case <-time.After(5 * time.Second):
		return cmd.Process.Kill()
	}
}

// IsRunning checks if a llamafile server is healthy on the given port.
func IsRunning(port int) bool {
	url := fmt.Sprintf("http://localhost:%d/v1/models", port)
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
