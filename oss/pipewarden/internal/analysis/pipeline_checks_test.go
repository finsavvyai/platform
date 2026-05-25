package analysis

import (
	"testing"
)

func TestCheckCurlPipeSh(t *testing.T) {
	t.Run("detects curl pipe sh", func(t *testing.T) {
		content := `
run:
  - curl https://example.com/install.sh | sh
`
		findings := CheckCurlPipeSh(content)
		if len(findings) == 0 {
			t.Error("expected finding for curl pipe sh, got none")
		}
		if findings[0].Severity != SeverityCritical {
			t.Errorf("expected critical severity, got %s", findings[0].Severity)
		}
	})

	t.Run("detects wget pipe bash", func(t *testing.T) {
		content := `run: wget https://example.com/setup.sh | bash`
		if len(CheckCurlPipeSh(content)) == 0 {
			t.Error("expected finding for wget pipe bash")
		}
	})

	t.Run("no finding for plain curl", func(t *testing.T) {
		content := `run: curl https://example.com/file.json -o output.json`
		if len(CheckCurlPipeSh(content)) != 0 {
			t.Error("expected no finding for plain curl without pipe")
		}
	})
}

func TestCheckHardcodedIPs(t *testing.T) {
	t.Run("detects external IP", func(t *testing.T) {
		content := `server: 8.8.8.8`
		findings := CheckHardcodedIPs(content)
		if len(findings) == 0 {
			t.Error("expected finding for 8.8.8.8, got none")
		}
		if findings[0].Severity != SeverityMedium {
			t.Errorf("expected medium severity, got %s", findings[0].Severity)
		}
	})

	t.Run("no finding for loopback", func(t *testing.T) {
		content := `host: 127.0.0.1`
		if len(CheckHardcodedIPs(content)) != 0 {
			t.Error("expected no finding for 127.0.0.1")
		}
	})

	t.Run("no finding for private RFC1918", func(t *testing.T) {
		content := `host: 192.168.1.1`
		if len(CheckHardcodedIPs(content)) != 0 {
			t.Error("expected no finding for 192.168.1.1")
		}
	})

	t.Run("no finding for 10.x private range", func(t *testing.T) {
		content := `host: 10.0.0.1`
		if len(CheckHardcodedIPs(content)) != 0 {
			t.Error("expected no finding for 10.0.0.1")
		}
	})
}

func TestCheckPrivilegedContainer(t *testing.T) {
	t.Run("detects privileged true", func(t *testing.T) {
		content := `
services:
  docker:
    privileged: true
`
		findings := CheckPrivilegedContainer(content)
		if len(findings) == 0 {
			t.Error("expected finding for privileged: true")
		}
		if findings[0].Severity != SeverityHigh {
			t.Errorf("expected high severity, got %s", findings[0].Severity)
		}
	})

	t.Run("no finding for privileged false", func(t *testing.T) {
		content := `privileged: false`
		if len(CheckPrivilegedContainer(content)) != 0 {
			t.Error("expected no finding for privileged: false")
		}
	})
}

func TestCheckOutdatedBaseImages(t *testing.T) {
	t.Run("detects ubuntu 18.04", func(t *testing.T) {
		content := `image: ubuntu:18.04`
		findings := CheckOutdatedBaseImages(content)
		if len(findings) == 0 {
			t.Error("expected finding for ubuntu:18.04")
		}
		if findings[0].Severity != SeverityMedium {
			t.Errorf("expected medium severity, got %s", findings[0].Severity)
		}
	})

	t.Run("detects node 12", func(t *testing.T) {
		content := `image: node:12`
		if len(CheckOutdatedBaseImages(content)) == 0 {
			t.Error("expected finding for node:12")
		}
	})

	t.Run("no finding for current ubuntu", func(t *testing.T) {
		content := `image: ubuntu:24.04`
		if len(CheckOutdatedBaseImages(content)) != 0 {
			t.Error("expected no finding for ubuntu:24.04")
		}
	})

	t.Run("no finding for current node", func(t *testing.T) {
		content := `image: node:22`
		if len(CheckOutdatedBaseImages(content)) != 0 {
			t.Error("expected no finding for node:22")
		}
	})
}

func TestCheckEnvVarSecrets(t *testing.T) {
	t.Run("detects hardcoded API_KEY", func(t *testing.T) {
		content := `
env:
  API_KEY=abc12345
`
		findings := CheckEnvVarSecrets(content)
		if len(findings) == 0 {
			t.Error("expected finding for API_KEY=abc12345")
		}
		if findings[0].Severity != SeverityHigh {
			t.Errorf("expected high severity, got %s", findings[0].Severity)
		}
	})

	t.Run("no finding for secret reference", func(t *testing.T) {
		content := `API_KEY=${{ secrets.API_KEY }}`
		if len(CheckEnvVarSecrets(content)) != 0 {
			t.Error("expected no finding for ${{ secrets.API_KEY }} reference")
		}
	})

	t.Run("no finding for short value", func(t *testing.T) {
		content := `TOKEN=abc`
		if len(CheckEnvVarSecrets(content)) != 0 {
			t.Error("expected no finding for short value (< 8 chars)")
		}
	})
}
