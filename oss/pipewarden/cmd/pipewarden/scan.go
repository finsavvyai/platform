package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"
)

// scanFlags holds parsed CLI flags for the scan subcommand.
type scanFlags struct {
	connection  string
	server      string
	minSeverity string
	format      string
}

// parseScanFlags parses the given args slice for the scan subcommand.
func parseScanFlags(args []string) (*scanFlags, error) {
	fs := flag.NewFlagSet("scan", flag.ContinueOnError)
	conn := fs.String("connection", "", "connection name to scan (required)")
	server := fs.String("server", "http://localhost:8080", "PipeWarden server base URL")
	severity := fs.String("severity", "high", "minimum severity threshold: critical|high|medium|low|all")
	format := fs.String("format", "text", "output format: text|json|sarif")

	if err := fs.Parse(args); err != nil {
		return nil, err
	}
	if *conn == "" {
		return nil, fmt.Errorf("--connection is required")
	}

	validSeverities := map[string]bool{
		"critical": true, "high": true, "medium": true, "low": true, "all": true,
	}
	if !validSeverities[*severity] {
		return nil, fmt.Errorf("invalid --severity %q: must be critical|high|medium|low|all", *severity)
	}

	validFormats := map[string]bool{"text": true, "json": true, "sarif": true}
	if !validFormats[*format] {
		return nil, fmt.Errorf("invalid --format %q: must be text|json|sarif", *format)
	}

	return &scanFlags{
		connection:  *conn,
		server:      *server,
		minSeverity: *severity,
		format:      *format,
	}, nil
}

// runScan executes a scan against the PipeWarden API and streams progress.
// Returns exit code: 0 = clean, 1 = findings at or above threshold found.
func runScan(baseURL, connection, minSeverity, outputFormat string) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	runID, err := startScan(ctx, baseURL, connection)
	if err != nil {
		return 1, fmt.Errorf("start scan: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Scan started  run_id=%s\n", runID)

	sseURL := fmt.Sprintf("%s/api/v1/scan/%s/progress", baseURL, runID)
	fmt.Fprintf(os.Stderr, "Streaming progress from %s\n\n", sseURL)

	completed := false
	sseErr := streamSSE(ctx, sseURL, func(data string) {
		var event struct {
			Stage   string `json:"stage"`
			Percent int    `json:"percent"`
			Message string `json:"message"`
		}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			return
		}
		printProgress(event.Stage, event.Percent, event.Message)
		if event.Stage == "complete" {
			completed = true
		}
	})

	if sseErr != nil && !completed {
		fmt.Fprintf(os.Stderr, "SSE stream ended: %v\n", sseErr)
	}
	fmt.Fprintln(os.Stderr, "")

	findings, err := fetchFindings(ctx, baseURL, connection, runID, outputFormat)
	if err != nil {
		return 1, fmt.Errorf("fetch findings: %w", err)
	}

	outputFindings(ctx, baseURL, connection, outputFormat, findings)

	return countThresholdExceeded(findings, minSeverity), nil
}

// outputFindings dispatches to the correct formatter.
func outputFindings(ctx context.Context, baseURL, connection, format string, findings []interface{}) {
	switch format {
	case "json":
		printFindingsJSON(findings)
	case "sarif":
		if err := printFindingsSARIF(ctx, baseURL, connection); err != nil {
			fmt.Fprintf(os.Stderr, "SARIF export error: %v\n", err)
		}
	default:
		printFindingsText(findings)
	}
}

// countThresholdExceeded returns 1 if any finding meets the threshold, 0 otherwise.
func countThresholdExceeded(findings []interface{}, minSeverity string) int {
	exceeded := 0
	for _, raw := range findings {
		m, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		sev, _ := m["severity"].(string)
		if meetsThreshold(sev, minSeverity) {
			exceeded++
		}
	}
	if exceeded > 0 {
		fmt.Fprintf(os.Stderr, "\n%d finding(s) at or above %q severity threshold.\n", exceeded, minSeverity)
		return 1
	}
	fmt.Fprintf(os.Stderr, "\nNo findings at or above %q severity threshold.\n", minSeverity)
	return 0
}

// printProgress writes a single-line carriage-return progress indicator to stderr.
func printProgress(stage string, percent int, message string) {
	bar := buildProgressBar(percent, 20)
	fmt.Fprintf(os.Stderr, "\r[%s] %3d%%  %-12s  %s", bar, percent, stage, message)
}

// buildProgressBar renders a simple ASCII progress bar of the given width.
func buildProgressBar(percent, width int) string {
	filled := percent * width / 100
	if filled > width {
		filled = width
	}
	bar := make([]byte, width)
	for i := range bar {
		if i < filled {
			bar[i] = '#'
		} else {
			bar[i] = '.'
		}
	}
	return string(bar)
}

// scanSubcommand is the testable form of handleScanSubcommand. Returns the
// process exit code instead of calling os.Exit so unit tests can drive it.
func scanSubcommand(args []string) int {
	flags, err := parseScanFlags(args)
	if err != nil {
		fmt.Fprintf(os.Stderr, "scan: %v\n", err)
		return 2
	}
	code, err := runScan(flags.server, flags.connection, flags.minSeverity, flags.format)
	if err != nil {
		fmt.Fprintf(os.Stderr, "scan error: %v\n", err)
		return 1
	}
	return code
}

// handleScanSubcommand is the entry point invoked from main when os.Args[1] == "scan".
func handleScanSubcommand(args []string) {
	os.Exit(scanSubcommand(args))
}
