package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/observe"
)

func cmdTrace(args []string) error {
	if wantsHelp(args) {
		printSubUsage("trace",
			"pushci trace [run-id] [flags]",
			"Inspect Perfetto performance traces from previous runs.",
			[][2]string{
				{"--list, -l", "list available traces"},
				{"--open, -o", "open Perfetto UI in browser"},
			},
			[]string{
				"pushci trace --list",
				"pushci trace <run-id>",
			})
		return nil
	}
	root, _ := os.Getwd()

	if hasFlag(args, "--list", "-l") {
		return listTraces(root)
	}

	runID := traceArg(args)
	if runID != "" {
		return showTrace(root, runID)
	}

	if hasFlag(args, "--open", "-o") {
		return openPerfetto()
	}

	return listTraces(root)
}

func listTraces(root string) error {
	files, err := observe.ListTraceFiles(root)
	if err != nil {
		cli.Warn("No traces found. Run: pushci run --trace")
		return nil
	}
	cli.Header("Available Traces")
	for _, f := range files {
		name := strings.TrimSuffix(f, ".json")
		path := filepath.Join(root, ".pushci", "traces", f)
		info, _ := os.Stat(path)
		size := ""
		if info != nil {
			size = fmt.Sprintf("(%dKB)", info.Size()/1024)
		}
		fmt.Printf("  %s %s\n", cli.Blue(name), cli.Dim(size))
	}
	fmt.Println()
	cli.Info("Open in Perfetto: pushci trace --open")
	cli.Info("View trace: pushci trace <run-id>")
	return nil
}

func showTrace(root, runID string) error {
	path := filepath.Join(root, ".pushci", "traces", runID+".json")
	if _, err := os.Stat(path); err != nil { // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
		return fmt.Errorf("trace not found: %s", runID)
	}
	cli.Header(fmt.Sprintf("Trace: %s", runID))
	cli.Info(fmt.Sprintf("File: %s", path))
	cli.Info("Open in browser: pushci trace --open")
	return nil
}

func openPerfetto() error {
	url := "https://ui.perfetto.dev"
	cli.Info(fmt.Sprintf("Opening %s ...", url))
	cli.Info("Drag a .pushci/traces/*.json file into Perfetto to visualize.")
	openBrowser(url)
	return nil
}

func traceArg(args []string) string {
	for _, a := range args {
		if !strings.HasPrefix(a, "-") {
			return a
		}
	}
	return ""
}
