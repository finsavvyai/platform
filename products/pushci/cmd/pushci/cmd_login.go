package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/cli"
)

const apiBase = "https://api.pushci.dev"

type pushciConfig struct {
	Token         string `json:"token,omitempty"`
	Login         string `json:"login,omitempty"`
	Plan          string `json:"plan,omitempty"`
	Email         string `json:"email,omitempty"`
	Name          string `json:"name,omitempty"`
	NoTelemetry   bool   `json:"no_telemetry,omitempty"`
	TelemetrySeen bool   `json:"telemetry_seen,omitempty"`
}

func configDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".pushci")
}

func configPath() string {
	return filepath.Join(configDir(), "config.json")
}

func loadConfig() *pushciConfig {
	data, err := os.ReadFile(configPath())
	if err != nil {
		return nil
	}
	var cfg pushciConfig
	if json.Unmarshal(data, &cfg) != nil {
		return nil
	}
	return &cfg
}

func saveConfig(cfg *pushciConfig) error {
	if err := os.MkdirAll(configDir(), 0700); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(cfg, "", "  ")
	return os.WriteFile(configPath(), data, 0600)
}

func cmdLogin() error {
	cli.Header("PushCI Login")
	url := loginURLForArgs(os.Args[2:])
	cli.Info("Opening browser for login...")
	cli.Info(cli.Blue(url))
	openBrowser(url)

	fmt.Print("\n  Paste your token: ")
	var token string
	fmt.Scanln(&token)
	if token == "" {
		return fmt.Errorf("no token provided")
	}

	cfg := &pushciConfig{Token: token}
	if err := saveConfig(cfg); err != nil {
		return fmt.Errorf("save config: %w", err)
	}
	cli.Success("Logged in! Token saved to ~/.pushci/config.json")
	cli.Info("AI features now use your PushCI Pro plan")
	cli.Info("Opening dashboard...")
	openBrowser("https://app.pushci.dev")
	return nil
}

func cmdLogout() error {
	if err := os.Remove(configPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	cli.Success("Logged out. Token removed.")
	return nil
}
