package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/intel"
)

const indexAPIBase = "https://api.pushci.dev"

func printHotspots(root string) {
	hotspots, _ := intel.GitHotspots(root, 8)
	if len(hotspots) == 0 {
		return
	}
	fmt.Println()
	cli.Info("Git hotspots (most changed files):")
	for _, h := range hotspots {
		fmt.Printf("  %s %s (%d changes, %d authors)\n", cli.Dot(), h.File, h.Changes, h.Authors)
	}
}

func uploadIfAuth(root string, ci *intel.CodeIntel, sp *cli.Spinner) {
	repo := gitRemoteRepo()
	token := ""
	if cfg := loadConfig(); cfg != nil {
		token = cfg.Token
	}
	if envToken := os.Getenv("PUSHCI_TOKEN"); envToken != "" {
		token = envToken
	}

	if token != "" && repo != "" {
		sp.Start("Uploading code intelligence...")
		err := uploadGraph(repo, ci.DepGraph, token)
		sp.Stop(err == nil)
		if err != nil {
			cli.Warn("Upload failed: " + err.Error())
		} else {
			cli.Success("Intelligence uploaded — blast radius + smart test selection enabled")
		}
	} else {
		fmt.Println()
		fmt.Println(cli.Dim("  Tip: " + cli.Blue("pushci login") + " to upload and enable blast radius analysis"))
	}
}

func uploadGraph(repo string, graph intel.DepGraph, token string) error {
	body, _ := json.Marshal(map[string]interface{}{"graph": graph})
	url := fmt.Sprintf("%s/api/impact/graph/%s", indexAPIBase, repo)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("api returned %d", resp.StatusCode)
	}
	return nil
}
