package observe

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

// WriteTraceFile saves a trace to .pushci/traces/{runID}.json.
func WriteTraceFile(tracer *Tracer, root, runID string) (string, error) {
	dir := filepath.Join(root, ".pushci", "traces")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create trace dir: %w", err)
	}
	path := filepath.Join(dir, runID+".json")
	f, err := os.Create(path)
	if err != nil {
		return "", fmt.Errorf("create trace file: %w", err)
	}
	defer f.Close()
	if err := tracer.Export(f); err != nil {
		return "", fmt.Errorf("write trace: %w", err)
	}
	return path, nil
}

// ListTraceFiles returns trace files sorted newest first.
func ListTraceFiles(root string) ([]string, error) {
	dir := filepath.Join(root, ".pushci", "traces")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".json" {
			files = append(files, e.Name())
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(files)))
	return files, nil
}

// PrintTraceSummary prints a timing breakdown of trace events.
func PrintTraceSummary(tracer *Tracer) {
	events := tracer.Events()
	fmt.Printf("\n%-30s %10s\n", "Event", "Duration")
	fmt.Printf("%-30s %10s\n", "-----", "--------")
	for _, e := range events {
		if e.Ph == "X" {
			ms := float64(e.Dur) / 1000.0
			fmt.Printf("%-30s %8.1fms\n", e.Name, ms)
		}
	}
}
