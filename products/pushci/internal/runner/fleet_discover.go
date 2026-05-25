package runner

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"time"
)

type tailscaleStatusJSON struct {
	Peer map[string]tsPeer `json:"Peer"`
}

type tsPeer struct {
	HostName     string   `json:"HostName"`
	TailscaleIPs []string `json:"TailscaleIPs"`
	Tags         []string `json:"Tags"`
	Online       bool     `json:"Online"`
}

// DiscoverPeers queries tailscale status --json and returns fleet nodes.
func DiscoverPeers(ctx context.Context) ([]FleetNode, error) {
	bin, err := FindTailscaleBinary()
	if err != nil {
		return nil, err
	}
	cmd := exec.CommandContext(ctx, bin, "status", "--json")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("tailscale status: %w", err)
	}
	return parsePeers(out)
}

func parsePeers(data []byte) ([]FleetNode, error) {
	var status tailscaleStatusJSON
	if err := json.Unmarshal(data, &status); err != nil {
		return nil, fmt.Errorf("parse tailscale status: %w", err)
	}
	var nodes []FleetNode
	for _, p := range status.Peer {
		ip := ""
		if len(p.TailscaleIPs) > 0 {
			ip = p.TailscaleIPs[0]
		}
		nodes = append(nodes, FleetNode{
			Hostname: p.HostName,
			IP:       ip,
			Tags:     p.Tags,
			Online:   p.Online,
		})
	}
	return nodes, nil
}

// Ping measures round-trip latency to a fleet node via HTTP health check.
func Ping(ctx context.Context, node FleetNode) (time.Duration, error) {
	url := fmt.Sprintf("http://%s:9376/health", node.IP)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, err
	}
	client := &http.Client{Timeout: 5 * time.Second}
	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("ping %s: %w", node.Hostname, err)
	}
	defer resp.Body.Close()
	return time.Since(start), nil
}
