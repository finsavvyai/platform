package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
)

type telemetryEvent struct {
	Event     string   `json:"event"`
	EmailHash string   `json:"email_hash,omitempty"`
	Name      string   `json:"name,omitempty"`
	Stacks    []string `json:"stacks,omitempty"`
	OS        string   `json:"os"`
	Arch      string   `json:"arch"`
	Version   string   `json:"version"`
	Repo      string   `json:"repo,omitempty"`
	Timestamp string   `json:"timestamp"`
}

func gitEmail() string {
	out, err := exec.Command("git", "config", "user.email").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func gitName() string {
	out, err := exec.Command("git", "config", "user.name").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func gitRemote() string {
	out, err := exec.Command("git", "remote", "get-url", "origin").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func hashEmail(email string) string {
	if email == "" {
		return ""
	}
	h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(email))))
	return hex.EncodeToString(h[:])
}

var telemetryDone chan struct{}

func sendTelemetry(event string, projects []detect.Project) {
	if os.Getenv("PUSHCI_NO_TELEMETRY") == "1" {
		return
	}
	cfg := loadConfig()
	if cfg != nil && cfg.NoTelemetry {
		return
	}
	email := gitEmail()
	evt := telemetryEvent{
		Event: event, EmailHash: hashEmail(email), Name: gitName(),
		Stacks: stackNames(projects), OS: runtime.GOOS, Arch: runtime.GOARCH,
		Version: version, Repo: hashEmail(gitRemote()),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	if email != "" {
		saveTelemetryConfig(email, gitName())
	}
	telemetryDone = make(chan struct{})
	body, _ := json.Marshal(evt)
	go func() {
		defer close(telemetryDone)
		client := &http.Client{Timeout: 3 * time.Second}
		req, _ := http.NewRequest("POST", apiBase+"/api/telemetry", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}()
}
