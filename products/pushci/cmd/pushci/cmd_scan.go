package main

import (
	"flag"
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/security"
)

func cmdScan(args []string) error {
	fs := flag.NewFlagSet("scan", flag.ContinueOnError)
	format := fs.String("format", "text", "output format: text, json, or sarif")
	report := fs.String("report", "text", "report format: text, json, or sarif")
	fs.Parse(args)

	// Support both --format and --report flags
	reportFormat := *report
	if reportFormat == "text" && *format != "text" {
		reportFormat = *format
	}
	machine := reportFormat == "json" || reportFormat == "sarif"

	if !machine {
		cli.Header("PushCI Security Scanner")
	}

	configs := findPipelineConfigs()
	if len(configs) == 0 {
		if !machine {
			cli.Warn("No pipeline configs found")
		}
		return nil
	}

	if !machine {
		cli.Info(fmt.Sprintf("Found %d config(s)", len(configs)))
		fmt.Println()
	}

	allResults, hasIssues := scanConfigs(configs, machine)

	if reportFormat == "sarif" {
		// For SARIF, merge all results into a single report
		mergedResult := &security.PipelineScanResult{
			Findings: []security.PipelineFinding{},
		}
		for _, r := range allResults {
			mergedResult.Findings = append(mergedResult.Findings, r.Findings...)
		}
		return scanOutputSARIF(mergedResult)
	}

	if reportFormat == "json" {
		return scanOutputJSON(allResults)
	}

	for i, result := range allResults {
		if i > 0 {
			fmt.Println()
		}
		scanPrintResult(result)
	}

	if hasIssues && !machine {
		fmt.Println()
		cli.Warn("Security issues found")
		return fmt.Errorf("scan found issues")
	} else if hasIssues {
		return fmt.Errorf("scan found issues")
	}

	if !machine {
		cli.Success("All configs passed security scan")
	}
	return nil
}
