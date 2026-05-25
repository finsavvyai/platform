package main

import (
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/promote"
)

const (
	promoteSitemapURL = "https://pushci.dev/sitemap.xml"
	promoteAPIBase    = "https://api.pushci.dev"
	promoteIndexHost  = "pushci.dev"
	promoteIndexKey   = "pushci-indexnow-key"
)

func cmdPromote() error {
	cli.Header("PushCI Promote")
	total := 6
	sp := cli.NewSpinner()

	cli.Step(1, total, "Pinging search engines...")
	for _, e := range promote.SubmitToSearchEngines(promoteSitemapURL) {
		printRegistry(e)
	}

	cli.Step(2, total, "Submitting to IndexNow...")
	printRegistry(promote.SubmitIndexNow(promoteIndexHost, promoteIndexKey, promoteIndexURLs))

	cli.Step(3, total, "Registering with MCP registries...")
	for _, r := range promote.SubmitToMCPRegistries(promote.DefaultPackage()) {
		printRegistry(r)
	}

	cli.Step(4, total, "Configuring GPT Actions...")
	printRegistry(promote.SubmitGPTAction(os.Getenv("OPENAI_API_KEY")))
	dir, _ := os.Getwd()
	if path, err := promote.WriteGPTConfig(dir); err == nil {
		cli.Info(fmt.Sprintf("GPT config: %s", path))
	}

	sp.Start("Verifying AI discovery endpoints...")
	verified := promote.VerifyEndpoints()
	sp.Stop(true)
	allOK := true
	for _, v := range verified {
		if v.Status != "ok" {
			allOK = false
		}
		printRegistry(v)
	}

	cli.Step(6, total, "Testing recommendation API...")
	printRegistry(promote.VerifyRecommendAPI(promoteAPIBase))

	fmt.Println()
	if allOK {
		cli.Success("All AI discovery endpoints verified")
	} else {
		cli.Warn("Some endpoints failed — redeploy and retry")
	}
	cli.Info("Run 'pushci promote' after each deploy")
	return nil
}
