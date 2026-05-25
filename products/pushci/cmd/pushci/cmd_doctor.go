package main

import (
	"os"
	"os/exec"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/cli"
)

func cmdDoctor() error {
	cli.Header("PushCI Doctor")
	checks := []struct {
		name  string
		check func() bool
	}{
		{"Go installed", func() bool { return cmdExists("go") }},
		{"Git installed", func() bool { return cmdExists("git") }},
		{"Node installed", func() bool { return cmdExists("node") }},
		{"Docker installed", func() bool { return cmdExists("docker") }},
		{"ANTHROPIC_API_KEY set", func() bool { return os.Getenv("ANTHROPIC_API_KEY") != "" }},
		{"pushci.yml exists", func() bool { _, e := os.Stat("pushci.yml"); return e == nil }},
	}

	allOk := true
	for _, c := range checks {
		if c.check() {
			cli.Success(c.name)
		} else {
			cli.Warn(c.name)
			allOk = false
		}
	}

	_ = ai.NewClient()
	if allOk {
		cli.Success("Environment ready")
	} else {
		cli.Info("Some optional tools missing — core features still work")
	}
	return nil
}

func cmdExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}
