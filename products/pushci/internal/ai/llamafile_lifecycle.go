package ai

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// ModelConfig describes a llamafile model for local AI.
type ModelConfig struct {
	Name string
	URL  string
	Size int64
	Path string
}

// DefaultModels lists well-known llamafile models.
var DefaultModels = map[string]ModelConfig{
	"tinyllama": {
		Name: "tinyllama",
		URL:  "https://huggingface.co/jartine/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/TinyLlama-1.1B-Chat-v1.0.Q5_K_M.llamafile",
		Size: 800_000_000,
	},
	"phi-2": {
		Name: "phi-2",
		URL:  "https://huggingface.co/jartine/phi-2-GGUF/resolve/main/phi-2.Q5_K_M.llamafile",
		Size: 2_000_000_000,
	},
	"mistral-7b": {
		Name: "mistral-7b",
		URL:  "https://huggingface.co/jartine/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.llamafile",
		Size: 4_400_000_000,
	},
}

// Download fetches a llamafile model binary to disk.
func Download(ctx context.Context, model ModelConfig, progress func(float64)) error {
	dir := filepath.Dir(model.Path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "GET", model.URL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("download %s: %w", model.Name, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download %s: HTTP %d", model.Name, resp.StatusCode)
	}
	f, err := os.Create(model.Path)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer f.Close()
	var written int64
	buf := make([]byte, 32*1024)
	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, wErr := f.Write(buf[:n]); wErr != nil {
				return fmt.Errorf("write: %w", wErr)
			}
			written += int64(n)
			if progress != nil && model.Size > 0 {
				progress(float64(written) / float64(model.Size))
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("read: %w", readErr)
		}
	}
	return os.Chmod(model.Path, 0o755)
}
