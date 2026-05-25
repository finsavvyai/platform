package main

import (
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
)

func waitTelemetry() {
	if telemetryDone == nil {
		return
	}
	select {
	case <-telemetryDone:
	case <-time.After(2 * time.Second):
	}
}

func saveTelemetryConfig(email, name string) {
	cfg := loadConfig()
	if cfg == nil {
		cfg = &pushciConfig{}
	}
	if cfg.Email == "" {
		cfg.Email = email
	}
	if cfg.Name == "" {
		cfg.Name = name
	}
	_ = saveConfig(cfg)
}

func printTelemetryNotice() {
	cfg := loadConfig()
	if cfg != nil && cfg.TelemetrySeen {
		return
	}

	fmt.Println(cli.Dim("  PushCI collects anonymous usage data to improve the product."))
	fmt.Println(cli.Dim("  Opt out: export PUSHCI_NO_TELEMETRY=1"))
	fmt.Println()

	if cfg == nil {
		cfg = &pushciConfig{}
	}
	cfg.TelemetrySeen = true
	_ = saveConfig(cfg)
}

func stackNames(projects []detect.Project) []string {
	seen := map[string]bool{}
	var stacks []string
	for _, p := range projects {
		s := string(p.Stack)
		if !seen[s] {
			seen[s] = true
			stacks = append(stacks, s)
		}
	}
	return stacks
}
