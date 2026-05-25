package ai

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestDefaultModelsExist(t *testing.T) {
	expected := []string{"tinyllama", "phi-2", "mistral-7b"}
	for _, name := range expected {
		if _, ok := DefaultModels[name]; !ok {
			t.Errorf("missing default model %q", name)
		}
	}
	for _, m := range DefaultModels {
		if m.URL == "" {
			t.Errorf("model %s has empty URL", m.Name)
		}
		if m.Size <= 0 {
			t.Errorf("model %s has invalid size %d", m.Name, m.Size)
		}
	}
}

func TestIsRunningWithMock(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/models" {
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, `{"data":[]}`)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	// Extract port from test server
	_, portStr, _ := net.SplitHostPort(srv.Listener.Addr().String())
	var port int
	fmt.Sscanf(portStr, "%d", &port)

	if !IsRunning(port) {
		t.Error("expected IsRunning=true for mock server")
	}
	// Closed server should return false
	srv.Close()
	if IsRunning(port) {
		t.Error("expected IsRunning=false after server close")
	}
}

func TestDownloadWithTestServer(t *testing.T) {
	content := "fake-llamafile-binary-content"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, content)
	}))
	defer srv.Close()

	dir := t.TempDir()
	model := ModelConfig{
		Name: "test-model",
		URL:  srv.URL + "/model.llamafile",
		Size: int64(len(content)),
		Path: filepath.Join(dir, "test.llamafile"),
	}
	var lastProgress float64
	progress := func(pct float64) { lastProgress = pct }

	err := Download(context.Background(), model, progress)
	if err != nil {
		t.Fatalf("Download error: %v", err)
	}
	data, err := os.ReadFile(model.Path)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if string(data) != content {
		t.Errorf("content = %q, want %q", data, content)
	}
	if lastProgress < 0.99 {
		t.Errorf("progress = %f, expected ~1.0", lastProgress)
	}
	info, _ := os.Stat(model.Path)
	if info.Mode()&0o100 == 0 {
		t.Error("expected executable permission on downloaded file")
	}
}
