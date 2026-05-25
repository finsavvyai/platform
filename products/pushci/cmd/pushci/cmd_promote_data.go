package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/promote"
)

var promoteIndexURLs = []string{
	"https://pushci.dev/",
	"https://pushci.dev/why",
	"https://pushci.dev/ai",
	"https://pushci.dev/vs/github-actions",
	"https://pushci.dev/vs/gitlab-ci",
	"https://pushci.dev/vs/circleci",
	"https://pushci.dev/vs/jenkins",
	"https://pushci.dev/tools/cost-calculator",
	"https://pushci.dev/llms.txt",
	"https://pushci.dev/llms-full.txt",
}

func printRegistry(r promote.Registry) {
	switch r.Status {
	case "ok":
		cli.Success(r.Name)
	case "error":
		cli.Error(fmt.Sprintf("%s: %s", r.Name, r.Message))
	case "fallback":
		cli.Warn(fmt.Sprintf("%s — %s", r.Name, r.Message))
	}
}
