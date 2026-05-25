package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

// handleDLPSubcommand scans one or more files/directories using the
// built-in DLP scanner. Exits 0 if no findings, 1 if any finding meets
// or exceeds --fail-on severity (default: high).
//
// Usage:
//
//	pipewarden dlp [--format=text|json] [--fail-on=critical|high|medium|low] <path>...
func handleDLPSubcommand(args []string) {
	os.Exit(dlpSubcommand(args))
}

// dlpSubcommand is the testable form of handleDLPSubcommand. Returns the
// process exit code instead of calling os.Exit.
func dlpSubcommand(args []string) int {
	fs := flag.NewFlagSet("dlp", flag.ContinueOnError)
	format := fs.String("format", "text", "output format: text or json")
	failOn := fs.String("fail-on", "high", "exit non-zero on findings at or above this severity (critical|high|medium|low|none)")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	paths := fs.Args()
	if len(paths) == 0 {
		fmt.Fprintln(os.Stderr, "usage: pipewarden dlp [--format=text|json] [--fail-on=...] <path>...")
		return 2
	}

	scanner := analysis.NewDLPScanner()
	all := make([]analysis.DLPFinding, 0)
	for _, p := range paths {
		findings, err := scanFileOrDir(scanner, p)
		if err != nil {
			fmt.Fprintf(os.Stderr, "scan error %s: %v\n", p, err)
			return 2
		}
		all = append(all, findings...)
	}

	switch *format {
	case "json":
		out, _ := json.MarshalIndent(all, "", "  ")
		fmt.Println(string(out))
	default:
		printDLPFindingsText(all)
	}

	if shouldFail(all, *failOn) {
		return 1
	}
	return 0
}

// skipDirs are walked over silently — they balloon scan time with low
// signal (deps, build outputs, VCS internals, IDE state).
var skipDirs = map[string]bool{
	".git": true, "node_modules": true, "vendor": true, "dist": true,
	"build": true, ".next": true, ".nuxt": true, "target": true,
	".idea": true, ".vscode": true, ".vscode-test": true, ".wrangler": true,
	"__pycache__": true, ".venv": true, "venv": true, ".tox": true,
	".pytest_cache": true, "coverage": true, ".turbo": true, ".cache": true,
}

// skipDirSuffixes blocks any directory whose name ENDS with these. Used
// for macOS bundles whose names vary (Visual Studio Code.app, Foo.framework).
var skipDirSuffixes = []string{".app", ".framework", ".bundle", ".xcodeproj"}

// skipExt blocks binary/non-text file extensions to keep the scan fast.
var skipExt = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".ico": true,
	".pdf": true, ".zip": true, ".tar": true, ".gz": true, ".tgz": true,
	".woff": true, ".woff2": true, ".ttf": true, ".eot": true,
	".mp4": true, ".webm": true, ".mp3": true, ".wav": true,
	".so": true, ".dylib": true, ".dll": true, ".exe": true,
	".o": true, ".a": true, ".class": true, ".jar": true,
	".db": true, ".sqlite": true, ".sqlite3": true,
}

func scanFileOrDir(scanner *analysis.DLPScanner, path string) ([]analysis.DLPFinding, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return scanner.ScanFile(path)
	}

	var all []analysis.DLPFinding
	walkErr := filepath.Walk(path, func(p string, fi os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if fi.IsDir() {
			if skipDirs[fi.Name()] {
				return filepath.SkipDir
			}
			for _, suffix := range skipDirSuffixes {
				if strings.HasSuffix(fi.Name(), suffix) {
					return filepath.SkipDir
				}
			}
			return nil
		}
		if skipExt[filepath.Ext(p)] {
			return nil
		}
		// Skip files larger than 1 MB — secrets are short and big files
		// (lockfiles, generated SQL dumps) just slow us down.
		if fi.Size() > 1<<20 {
			return nil
		}
		findings, err := scanner.ScanFile(p)
		if err != nil {
			return nil // skip unreadable files silently — best-effort scan
		}
		all = append(all, findings...)
		return nil
	})
	return all, walkErr
}

func printDLPFindingsText(findings []analysis.DLPFinding) {
	if len(findings) == 0 {
		fmt.Println("✓ No secrets detected.")
		return
	}
	sort.SliceStable(findings, func(i, j int) bool {
		if findings[i].File != findings[j].File {
			return findings[i].File < findings[j].File
		}
		return findings[i].Line < findings[j].Line
	})
	fmt.Printf("⚠ %d finding(s)\n", len(findings))
	for _, f := range findings {
		fmt.Printf("  %s:%d  [%s] %s  match=%s  conf=%.2f\n",
			f.File, f.Line, f.Severity, f.Pattern, f.Match, f.Confidence)
	}
}

func shouldFail(findings []analysis.DLPFinding, failOn string) bool {
	if failOn == "none" {
		return false
	}
	threshold := severityRankAnalysis(failOn)
	for _, f := range findings {
		if severityRankAnalysis(string(f.Severity)) >= threshold {
			return true
		}
	}
	return false
}

func severityRankAnalysis(s string) int {
	switch s {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}
