package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad(t *testing.T) {
	yml := `on: [push, pull_request]
checks:
  - build
  - test
  - name: line-limit
    line-limit: 100
deploy:
  trigger: merge to main
  run: docker-compose up -d
notify:
  slack: https://hooks.slack.com/test
  discord: https://discord.com/api/webhooks/test
  email: team@company.com
`
	dir := t.TempDir()
	path := filepath.Join(dir, "pushci.yml")
	os.WriteFile(path, []byte(yml), 0o644)

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if len(cfg.On) != 2 {
		t.Errorf("On = %v, want 2 items", cfg.On)
	}
	if len(cfg.Checks) != 3 {
		t.Errorf("Checks = %d, want 3", len(cfg.Checks))
	}
	if cfg.Checks[0].Name != "build" {
		t.Errorf("Checks[0] = %s, want build", cfg.Checks[0].Name)
	}
	if cfg.Checks[2].Limit != 100 {
		t.Errorf("Checks[2].Limit = %d, want 100", cfg.Checks[2].Limit)
	}
	if len(cfg.Deploys) != 1 || cfg.Deploys[0].Run != "docker-compose up -d" {
		t.Errorf("Deploys = %v", cfg.Deploys)
	}
	if cfg.Notify == nil {
		t.Fatal("Notify is nil")
	}
	if cfg.Notify.Slack != "https://hooks.slack.com/test" {
		t.Errorf("Notify.Slack = %s", cfg.Notify.Slack)
	}
	if cfg.Notify.Discord != "https://discord.com/api/webhooks/test" {
		t.Errorf("Notify.Discord = %s", cfg.Notify.Discord)
	}
	if cfg.Notify.Email != "team@company.com" {
		t.Errorf("Notify.Email = %s", cfg.Notify.Email)
	}
}

func TestDefault(t *testing.T) {
	cfg := Default()
	if len(cfg.Checks) != 3 {
		t.Errorf("default checks = %d, want 3", len(cfg.Checks))
	}
}
