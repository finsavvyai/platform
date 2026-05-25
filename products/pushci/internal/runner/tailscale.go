package runner

import (
	"fmt"
	"net"
	"os/exec"
	"strings"
)

// TailscaleMode controls how the runner exposes itself via Tailscale.
type TailscaleMode string

const (
	TailscaleOff    TailscaleMode = "off"
	TailscaleServe  TailscaleMode = "serve"
	TailscaleFunnel TailscaleMode = "funnel"
)

// TailscaleConfig holds Tailscale integration settings.
type TailscaleConfig struct {
	Mode        TailscaleMode
	ResetOnExit bool
	Port        int
}

// FindTailscaleBinary locates the tailscale CLI.
func FindTailscaleBinary() (string, error) {
	if path, err := exec.LookPath("tailscale"); err == nil {
		return path, nil
	}
	macPath := "/Applications/Tailscale.app/Contents/MacOS/Tailscale"
	if _, err := exec.LookPath(macPath); err == nil {
		return macPath, nil
	}
	return "", fmt.Errorf("tailscale binary not found — install from https://tailscale.com/download")
}

// TailnetIP returns the Tailscale IPv4 address (100.x.x.x) if available.
func TailnetIP() (string, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "", err
	}
	for _, iface := range ifaces {
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ip, _, err := net.ParseCIDR(addr.String())
			if err != nil {
				continue
			}
			if ip.To4() != nil && ip[0] == 100 && ip[1] >= 64 && ip[1] <= 127 {
				return ip.String(), nil
			}
		}
	}
	return "", fmt.Errorf("no tailnet IP found — is Tailscale running?")
}

// TailscaleStatus returns hostname and IP from tailscale status.
func TailscaleStatus(bin string) (hostname, ip string, err error) {
	out, err := exec.Command(bin, "status", "--self", "--json").Output()
	if err != nil {
		return "", "", fmt.Errorf("tailscale status: %w", err)
	}
	s := string(out)
	if idx := strings.Index(s, `"DNSName":"`); idx >= 0 {
		rest := s[idx+11:]
		if end := strings.Index(rest, `"`); end >= 0 {
			hostname = strings.TrimSuffix(rest[:end], ".")
		}
	}
	if idx := strings.Index(s, `"TailscaleIPs":["`); idx >= 0 {
		rest := s[idx+17:]
		if end := strings.Index(rest, `"`); end >= 0 {
			ip = rest[:end]
		}
	}
	return hostname, ip, nil
}
