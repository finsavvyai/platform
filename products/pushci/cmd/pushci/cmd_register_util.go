package main

import (
	"os/exec"
	"strings"
)

func detectPlatform(repo string) string {
	remote, _ := exec.Command("git", "remote", "get-url", "origin").Output()
	url := strings.ToLower(string(remote))
	if strings.Contains(url, "gitlab") {
		return "gitlab"
	}
	if strings.Contains(url, "bitbucket") {
		return "bitbucket"
	}
	return "github"
}

func hostname() string {
	out, err := exec.Command("hostname", "-s").Output()
	if err != nil {
		return "local"
	}
	return strings.TrimSpace(string(out))
}
