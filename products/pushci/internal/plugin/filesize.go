package plugin

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// FileSizeLimitPlugin checks that no source file exceeds a line limit.
type FileSizeLimitPlugin struct{ MaxLines int }

func (p *FileSizeLimitPlugin) Name() string { return "line-limit" }

func (p *FileSizeLimitPlugin) Run(_ context.Context, dir string) (*Result, error) {
	start := time.Now()
	limit := p.MaxLines
	if limit == 0 {
		limit = 200
	}
	var violations []string
	for _, sub := range []string{"src", "app", "lib", "packages"} {
		filepath.Walk(filepath.Join(dir, sub), func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() || !isSourceFile(info.Name()) {
				return nil
			}
			if lines := countLines(path); lines > limit {
				rel, _ := filepath.Rel(dir, path)
				violations = append(violations, fmt.Sprintf("%s: %d lines (max %d)", rel, lines, limit))
			}
			return nil
		})
	}
	d := time.Since(start)
	if len(violations) > 0 {
		return &Result{Passed: false, Output: strings.Join(violations, "\n"), Duration: d}, nil
	}
	return &Result{Passed: true, Output: "all files within limit", Duration: d}, nil
}

func isSourceFile(name string) bool {
	for _, ext := range []string{".ts", ".svelte", ".go", ".js", ".tsx", ".jsx"} {
		if strings.HasSuffix(name, ext) {
			return true
		}
	}
	return false
}

func countLines(path string) int {
	f, err := os.Open(path)
	if err != nil {
		return 0
	}
	defer f.Close()
	n := 0
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		n++
	}
	return n
}
