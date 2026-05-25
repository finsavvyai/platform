package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEmbedPageReturnsHTML(t *testing.T) {
	h := &IFrameHandler{}
	r := httptest.NewRequest(http.MethodGet, "/embed?key=test", nil)
	w := httptest.NewRecorder()
	h.ServeEmbedPage(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if !strings.Contains(ct, "text/html") {
		t.Errorf("content-type: got %q want text/html", ct)
	}
	body := w.Body.String()
	for _, must := range []string{
		"<!doctype html>",
		"widget.js",
		`AEGIS.init`,
		"postMessage",
	} {
		if !strings.Contains(body, must) {
			t.Errorf("missing fragment %q in embed page", must)
		}
	}
}
