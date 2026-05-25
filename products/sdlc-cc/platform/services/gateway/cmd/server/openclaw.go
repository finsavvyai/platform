package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// OpenClawCapabilities represents a filesystem-derived capability snapshot from an OpenClaw installation.
type OpenClawCapabilities struct {
	Available   bool      `json:"available"`
	Root        string    `json:"root"`
	Discovered  time.Time `json:"discovered_at"`
	Channels    []string  `json:"channels"`
	Nodes       []string  `json:"nodes"`
	Extensions  []string  `json:"extensions"`
	Skills      []string  `json:"skills"`
	Total       int       `json:"total_capabilities"`
	Description string    `json:"description"`
}

func discoverOpenClawCapabilities(root string) OpenClawCapabilities {
	caps := OpenClawCapabilities{
		Available:   false,
		Root:        root,
		Discovered:  time.Now().UTC(),
		Description: "OpenClaw capability catalog from local installation",
	}

	stat, err := os.Stat(root)
	if err != nil || !stat.IsDir() {
		return caps
	}

	channels := discoverMarkdownNames(filepath.Join(root, "docs", "channels"))
	nodes := discoverMarkdownNames(filepath.Join(root, "docs", "nodes"))
	extensions := discoverDirectories(filepath.Join(root, "extensions"))
	skills := discoverSkillDirectories(filepath.Join(root, "skills"))

	caps.Available = true
	caps.Channels = channels
	caps.Nodes = nodes
	caps.Extensions = extensions
	caps.Skills = skills
	caps.Total = len(channels) + len(nodes) + len(extensions) + len(skills)

	return caps
}

func discoverMarkdownNames(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".md") {
			continue
		}
		slug := strings.TrimSuffix(name, filepath.Ext(name))
		if slug == "index" || slug == "troubleshooting" {
			continue
		}
		names = append(names, slug)
	}

	sort.Strings(names)
	return names
}

func discoverDirectories(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			names = append(names, entry.Name())
		}
	}

	sort.Strings(names)
	return names
}

func discoverSkillDirectories(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		skillPath := filepath.Join(dir, entry.Name(), "SKILL.md")
		if _, err := os.Stat(skillPath); err == nil {
			names = append(names, entry.Name())
		}
	}

	sort.Strings(names)
	return names
}

func resolveOpenClawRoot() string {
	if configured := os.Getenv("OPENCLAW_ROOT"); strings.TrimSpace(configured) != "" {
		return strings.TrimSpace(configured)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "~/openclaw/openclaw"
	}

	return filepath.Join(home, "openclaw", "openclaw")
}

func (app *Application) handleOpenClawCapabilities(w http.ResponseWriter, r *http.Request) {
	root := resolveOpenClawRoot()
	caps := discoverOpenClawCapabilities(root)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(caps)
}

func (app *Application) handleOpenClawHealth(w http.ResponseWriter, r *http.Request) {
	root := resolveOpenClawRoot()
	caps := discoverOpenClawCapabilities(root)

	status := "unavailable"
	httpCode := http.StatusServiceUnavailable
	if caps.Available {
		status = "ok"
		httpCode = http.StatusOK
	}

	response := map[string]any{
		"status": status,
		"root":   root,
		"counts": map[string]int{
			"channels":   len(caps.Channels),
			"nodes":      len(caps.Nodes),
			"extensions": len(caps.Extensions),
			"skills":     len(caps.Skills),
			"total":      caps.Total,
		},
		"timestamp": time.Now().UTC(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpCode)
	_ = json.NewEncoder(w).Encode(response)
}
