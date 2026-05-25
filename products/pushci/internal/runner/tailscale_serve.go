package runner

import (
	"fmt"
	"os/exec"
)

// EnableServe starts Tailscale Serve on the given port.
func EnableServe(bin string, port int) error {
	url := fmt.Sprintf("http://localhost:%d", port)
	cmd := exec.Command(bin, "serve", "--bg", url)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("tailscale serve: %s — %w", out, err)
	}
	return nil
}

// EnableFunnel starts Tailscale Funnel (public) on the given port.
func EnableFunnel(bin string, port int) error {
	url := fmt.Sprintf("http://localhost:%d", port)
	cmd := exec.Command(bin, "funnel", "--bg", url)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("tailscale funnel: %s — %w", out, err)
	}
	return nil
}

// DisableServe stops Tailscale Serve/Funnel.
func DisableServe(bin string) {
	_ = exec.Command(bin, "serve", "--remove", "/").Run()
	_ = exec.Command(bin, "funnel", "--remove", "/").Run()
}
