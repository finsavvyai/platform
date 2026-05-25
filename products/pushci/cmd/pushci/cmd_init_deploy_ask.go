package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

func askDeployTarget() []config.DeployTarget {
	// Defense in depth: any caller that forgets to consult
	// isNonInteractive still won't block on fmt.Scanln.
	if isNonInteractive(os.Args[2:]) {
		return nil
	}
	options := []struct {
		key, label, command string
	}{
		{"1", "Cloudflare Workers/Pages", "npx wrangler deploy"},
		{"2", "Vercel", "npx vercel --prod"},
		{"3", "Netlify", "npx netlify deploy --prod"},
		{"4", "Fly.io", "fly deploy"},
		{"5", "Railway", "railway up"},
		{"6", "AWS (Serverless)", "npx serverless deploy"},
		{"7", "Docker", "docker compose up -d --build"},
		{"8", "Kubernetes", "kubectl apply -f k8s/"},
		{"9", "Custom command", ""},
		{"0", "Skip (no deploy)", ""},
	}

	fmt.Println()
	cli.Info("No deploy target detected. Where do you deploy?")
	fmt.Println()
	for _, o := range options {
		fmt.Printf("    %s  %s\n", cli.Blue(o.key), o.label)
	}
	fmt.Print("\n  Choice [0]: ")

	var choice string
	fmt.Scanln(&choice)
	choice = strings.TrimSpace(choice)
	if choice == "" || choice == "0" {
		return nil
	}

	var cmd string
	for _, o := range options {
		if o.key == choice {
			cmd = o.command
			if choice == "9" {
				fmt.Print("  Deploy command: ")
				fmt.Scanln(&cmd)
				cmd = strings.TrimSpace(cmd)
				if cmd == "" {
					return nil
				}
			}
			break
		}
	}
	if cmd == "" {
		return nil
	}
	return []config.DeployTarget{{
		Name: "deploy", Trigger: "push", OnlyOn: []string{"main", "master"}, Run: cmd,
	}}
}
