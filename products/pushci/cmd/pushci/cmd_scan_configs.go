package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/security"
)

func scanConfigs(configs []string, silent bool) ([]*security.PipelineScanResult, bool) {
	var results []*security.PipelineScanResult
	hasIssues := false
	for _, config := range configs {
		var result *security.PipelineScanResult
		var err error
		if !silent {
			sp := cli.NewSpinner()
			sp.Start(fmt.Sprintf("Scanning %s...", config))
			result, err = security.ScanPipelineConfig(config)
			sp.Stop(err == nil)
		} else {
			result, err = security.ScanPipelineConfig(config)
		}
		if err != nil {
			if !silent {
				cli.Error(fmt.Sprintf("Failed to scan %s: %v", config, err))
			}
			continue
		}
		results = append(results, result)
		if len(result.Findings) > 0 {
			hasIssues = true
		}
	}
	return results, hasIssues
}

func findPipelineConfigs() []string {
	var configs []string
	candidates := []string{
		"pushci.yml",
		".github/workflows/*.yml",
		".gitlab-ci.yml",
		"bitbucket-pipelines.yml",
	}
	for _, pattern := range candidates {
		if filepath.Base(pattern) == pattern {
			if _, err := os.Stat(pattern); err == nil {
				configs = append(configs, pattern)
			}
		} else {
			matches, _ := filepath.Glob(pattern)
			configs = append(configs, matches...)
		}
	}
	return configs
}
