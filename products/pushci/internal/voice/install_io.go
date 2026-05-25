package voice

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

func fetchYAML(ctx context.Context, src string) ([]byte, error) {
	c := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, src, nil)
	req.Header.Set("Accept", "text/yaml, application/yaml, text/plain")
	req.Header.Set("User-Agent", "pushci-voice-install/1")
	resp, err := c.Do(req)
	if err != nil {
		return nil, fmt.Errorf("voice install: fetch failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("voice install: HTTP %d from %s", resp.StatusCode, src)
	}
	return io.ReadAll(io.LimitReader(resp.Body, maxVoicesFileBytes+1))
}

func parseRemoteVoicesFile(body []byte) (userVoicesFile, error) {
	if len(body) > maxVoicesFileBytes {
		return userVoicesFile{}, fmt.Errorf("voice install: file exceeds %d bytes", maxVoicesFileBytes)
	}
	var file userVoicesFile
	if err := yaml.Unmarshal(body, &file); err != nil {
		return userVoicesFile{}, fmt.Errorf("voice install: parse: %w", err)
	}
	return file, nil
}

func mergeIntoLocalFile(dest string, incoming userVoicesFile) (int, error) {
	existing := readExistingFile(dest)
	known := map[string]bool{}
	for _, p := range existing.Personas {
		known[strings.ToLower(p.Name)] = true
	}
	added := 0
	for _, p := range incoming.Personas {
		if p.Name == "" || len(p.Phrases) == 0 || known[strings.ToLower(p.Name)] {
			continue
		}
		existing.Personas = append(existing.Personas, p)
		known[strings.ToLower(p.Name)] = true
		added++
	}
	if err := writeVoicesFile(dest, existing); err != nil {
		return 0, err
	}
	return added, nil
}

func readExistingFile(path string) userVoicesFile {
	var file userVoicesFile
	if data, err := os.ReadFile(path); err == nil {
		_ = yaml.Unmarshal(data, &file)
	}
	return file
}

func writeVoicesFile(path string, file userVoicesFile) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("voice install: mkdir: %w", err)
	}
	out, err := yaml.Marshal(file)
	if err != nil {
		return fmt.Errorf("voice install: marshal: %w", err)
	}
	return os.WriteFile(path, out, 0o600)
}
