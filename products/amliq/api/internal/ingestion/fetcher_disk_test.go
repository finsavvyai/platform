package ingestion

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

// TestFetchToDisk_HappyPath verifies a clean 200 response lands in
// a temp file whose contents match the body exactly.
func TestFetchToDisk_HappyPath(t *testing.T) {
	want := []byte("hello world from golden copy")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("ETag", `"test-etag"`)
		_, _ = w.Write(want)
	}))
	defer srv.Close()

	lf := NewListFetcher(5 * time.Second)
	path, etag, err := lf.FetchToDisk(srv.URL)
	if err != nil {
		t.Fatalf("FetchToDisk: %v", err)
	}
	defer os.Remove(path)
	if etag != `"test-etag"` {
		t.Errorf("etag = %q, want test-etag", etag)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if string(got) != string(want) {
		t.Errorf("file content = %q, want %q", got, want)
	}
}

// TestFetchToDisk_Non200 surfaces a non-200 as an error and does
// not create a temp file leak.
func TestFetchToDisk_Non200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "gone", http.StatusGone)
	}))
	defer srv.Close()
	lf := NewListFetcher(5 * time.Second)
	path, _, err := lf.FetchToDisk(srv.URL)
	if err == nil {
		t.Fatalf("expected error on non-200")
	}
	if path != "" {
		t.Errorf("path = %q, want empty", path)
	}
}

// TestFetchToDisk_EmptyURL rejects blank URLs cleanly.
func TestFetchToDisk_EmptyURL(t *testing.T) {
	lf := NewListFetcher(1 * time.Second)
	_, _, err := lf.FetchToDisk("")
	if err == nil {
		t.Errorf("expected error on empty URL")
	}
}
