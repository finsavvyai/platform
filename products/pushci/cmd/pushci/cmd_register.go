package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
)

func loadAuthToken() string {
	cfg := loadConfig()
	if cfg != nil && cfg.Token != "" {
		return cfg.Token
	}
	return ""
}

func autoRegister() {
	repo := gitRemoteRepo()
	if repo == "" {
		return
	}
	platform := detectPlatform(repo)
	token := loadAuthToken()
	registerProject(repo, platform, token)
	registerRunner(repo, token)
	seedInitialRun(repo, token)
}

func registerProject(repo, platform, token string) {
	body, _ := json.Marshal(map[string]string{"repo": repo, "platform": platform})
	req, _ := http.NewRequest("POST", apiBase+"/api/governance/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	resp.Body.Close()
	if resp.StatusCode < 300 {
		cli.Success(fmt.Sprintf("Registered %s on PushCI dashboard", repo))
	}
}

func registerRunner(repo, token string) {
	body, _ := json.Marshal(map[string]string{
		"repo": repo, "name": fmt.Sprintf("local-%s", hostname()),
		"os": runtime.GOOS, "arch": runtime.GOARCH, "version": version,
	})
	req, _ := http.NewRequest("POST", apiBase+"/api/runners/register-local", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	resp.Body.Close()
}

func gitRemoteRepo() string {
	out, err := exec.Command("git", "remote", "get-url", "origin").Output()
	if err != nil {
		return ""
	}
	url := strings.TrimSpace(string(out))
	if strings.Contains(url, ":") && strings.Contains(url, "git@") {
		parts := strings.Split(url, ":")
		return strings.TrimSuffix(parts[len(parts)-1], ".git")
	}
	url = strings.TrimSuffix(url, ".git")
	parts := strings.Split(url, "/")
	if len(parts) >= 2 {
		return parts[len(parts)-2] + "/" + parts[len(parts)-1]
	}
	return ""
}
