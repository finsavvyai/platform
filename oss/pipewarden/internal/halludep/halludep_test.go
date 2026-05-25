package halludep

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// stubTransport routes every request to the test server regardless of host.
type stubTransport struct{ srv *httptest.Server }

func (s *stubTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	target, _ := url.Parse(s.srv.URL)
	req.URL.Scheme = target.Scheme
	req.URL.Host = target.Host
	return http.DefaultTransport.RoundTrip(req)
}

func newCheckerWith(srv *httptest.Server) *Checker {
	return NewChecker(WithHTTPClient(&http.Client{Transport: &stubTransport{srv: srv}}))
}

func TestCheckNPMExists(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/lodash" {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"name":"lodash"}`))
	}))
	defer srv.Close()

	r := newCheckerWith(srv).Check(context.Background(), EcoNPM, "lodash")
	if r.Error != nil {
		t.Fatalf("unexpected error: %v", r.Error)
	}
	if !r.Exists {
		t.Errorf("expected exists=true, got %+v", r)
	}
	if IsHallucinated(r) {
		t.Error("real package wrongly flagged hallucinated")
	}
}

func TestCheckNPMHallucinated(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	r := newCheckerWith(srv).Check(context.Background(), EcoNPM, "lodahs-typo")
	if r.Error != nil {
		t.Fatalf("404 should not be an error, got %v", r.Error)
	}
	if r.Exists {
		t.Errorf("expected exists=false, got %+v", r)
	}
	if !IsHallucinated(r) {
		t.Error("404 should flag hallucinated")
	}
}

func TestCheckScopedNPM(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/%40acme/foo") && !strings.HasPrefix(r.URL.Path, "/@acme/foo") {
			t.Errorf("expected scoped path, got %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"name":"@acme/foo"}`))
	}))
	defer srv.Close()

	r := newCheckerWith(srv).Check(context.Background(), EcoNPM, "@acme/foo")
	if !r.Exists {
		t.Errorf("expected exists=true for scoped package: %+v", r)
	}
}

func TestCheck5xxIsNotHallucinated(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()

	r := newCheckerWith(srv).Check(context.Background(), EcoPyPI, "anything")
	if r.Exists {
		t.Errorf("5xx should not be Exists=true")
	}
	if IsHallucinated(r) {
		t.Error("5xx should not be IsHallucinated")
	}
}

func TestCheckEmptyName(t *testing.T) {
	r := NewChecker().Check(context.Background(), EcoNPM, "")
	if r.Error == nil {
		t.Error("expected error on empty name")
	}
}

func TestCheckMany(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "missing") {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = w.Write([]byte(`{"name":"ok"}`))
	}))
	defer srv.Close()

	items := []Item{
		{EcoNPM, "ok-pkg"},
		{EcoNPM, "missing-pkg"},
		{EcoPyPI, "ok-pkg"},
	}
	out := newCheckerWith(srv).CheckMany(context.Background(), items)
	if len(out) != 3 {
		t.Fatalf("expected 3 results, got %d", len(out))
	}
	if !out[0].Exists || !out[2].Exists {
		t.Errorf("expected ok packages to exist, got %+v", out)
	}
	if !IsHallucinated(out[1]) {
		t.Errorf("expected missing pkg flagged hallucinated, got %+v", out[1])
	}
}

func TestUnsupportedEcosystem(t *testing.T) {
	r := NewChecker().Check(context.Background(), Ecosystem("brainfuck"), "name")
	if r.Error == nil {
		t.Error("expected error for unsupported ecosystem")
	}
}
