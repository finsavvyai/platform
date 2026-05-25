package handlers

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestLatestTrace_NotFoundWhenAbsent(t *testing.T) {
	h := newTestHandlers(t)

	missing := filepath.Join(t.TempDir(), "no-such.trace")
	t.Setenv("PIPEWARDEN_TRACE_PATH", missing)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/trace/latest", nil)
	rec := httptest.NewRecorder()

	h.LatestTrace(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status: got %d want 404; body=%s", rec.Code, rec.Body.String())
	}
}

func TestLatestTrace_ServesFileWhenPresent(t *testing.T) {
	h := newTestHandlers(t)

	dir := t.TempDir()
	path := filepath.Join(dir, "pipewarden.trace")
	body := []byte("\x00fake-runtime-trace-bytes\x01\x02")
	if err := os.WriteFile(path, body, 0o600); err != nil {
		t.Fatalf("write trace fixture: %v", err)
	}
	t.Setenv("PIPEWARDEN_TRACE_PATH", path)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/trace/latest", nil)
	rec := httptest.NewRecorder()

	h.LatestTrace(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	if got := rec.Body.Bytes(); string(got) != string(body) {
		t.Errorf("body mismatch: got %q want %q", got, body)
	}
	if cd := rec.Header().Get("Content-Disposition"); cd == "" {
		t.Error("Content-Disposition missing — Perfetto download flow needs it")
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/octet-stream" {
		t.Errorf("Content-Type: got %q", ct)
	}
}

func TestLatestTrace_RejectsNonGET(t *testing.T) {
	h := newTestHandlers(t)
	for _, m := range []string{http.MethodPost, http.MethodPut, http.MethodDelete} {
		t.Run(m, func(t *testing.T) {
			req := httptest.NewRequest(m, "/api/v1/trace/latest", nil)
			rec := httptest.NewRecorder()
			h.LatestTrace(rec, req)
			if rec.Code != http.StatusMethodNotAllowed {
				t.Errorf("%s: got %d want 405", m, rec.Code)
			}
		})
	}
}
