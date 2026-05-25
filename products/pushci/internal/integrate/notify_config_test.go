package integrate

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/config"
)

func TestNotifyConfigParsed(t *testing.T) {
	yml := `on: [push]
checks:
  - name: test
    run: echo ok
notify:
  slack: https://hooks.slack.com/xxx
  discord: https://discord.com/api/webhooks/xxx
  telegram: "botTOKEN:12345"
  webhook: https://example.com/hook
`
	dir := t.TempDir()
	path := filepath.Join(dir, "pushci.yml")
	if err := os.WriteFile(path, []byte(yml), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}

	pipe, err := config.Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if pipe.Notify == nil {
		t.Fatal("Notify is nil")
	}
	nc := pipe.Notify
	if nc.Slack != "https://hooks.slack.com/xxx" {
		t.Errorf("slack = %s", nc.Slack)
	}
	if nc.Discord != "https://discord.com/api/webhooks/xxx" {
		t.Errorf("discord = %s", nc.Discord)
	}
	if nc.Telegram != "botTOKEN:12345" {
		t.Errorf("telegram = %s", nc.Telegram)
	}
	if nc.Webhook != "https://example.com/hook" {
		t.Errorf("webhook = %s", nc.Webhook)
	}
}

func TestNotifyConfigEmpty(t *testing.T) {
	yml := `on: [push]
checks:
  - name: test
    run: echo ok
`
	dir := t.TempDir()
	path := filepath.Join(dir, "pushci.yml")
	if err := os.WriteFile(path, []byte(yml), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}

	pipe, err := config.Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if pipe.Notify != nil {
		t.Error("expected Notify to be nil when not configured")
	}
}
