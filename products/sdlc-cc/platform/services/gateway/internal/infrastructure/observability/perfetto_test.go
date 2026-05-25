package observability

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestPerfetto_DisabledIsNoOp(t *testing.T) {
	t.Setenv("SDLC_PERFETTO", "")
	pf := NewPerfetto(PerfettoConfig{})
	mw := pf.Middleware()
	if mw == nil {
		t.Fatal("middleware nil even when disabled")
	}
	// Calling Flush + Close on a disabled emitter must not panic and
	// must not write a file.
	tmp := filepath.Join(t.TempDir(), "should-not-exist.json")
	pf.cfg.OutputPath = tmp
	if err := pf.Flush(); err != nil {
		t.Fatalf("Flush err: %v", err)
	}
	if _, err := os.Stat(tmp); err == nil {
		t.Fatal("trace file written when emitter disabled")
	}
	_ = pf.Close()
}

func TestPerfetto_EnabledRecordsRequest(t *testing.T) {
	t.Setenv("SDLC_PERFETTO", "1")
	tmp := filepath.Join(t.TempDir(), "trace.json")
	pf := NewPerfetto(PerfettoConfig{OutputPath: tmp})
	defer pf.Close()

	srv := httptest.NewServer(pf.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})))
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/teapot")
	if err != nil {
		t.Fatalf("GET err: %v", err)
	}
	_ = resp.Body.Close()

	if err := pf.Flush(); err != nil {
		t.Fatalf("Flush err: %v", err)
	}

	data, err := os.ReadFile(tmp)
	if err != nil {
		t.Fatalf("ReadFile err: %v", err)
	}
	var doc struct {
		TraceEvents []struct {
			Name  string                 `json:"name"`
			Phase string                 `json:"ph"`
			Args  map[string]interface{} `json:"args"`
		} `json:"traceEvents"`
	}
	if err := json.Unmarshal(data, &doc); err != nil {
		t.Fatalf("unmarshal err: %v\n%s", err, string(data))
	}
	if len(doc.TraceEvents) != 1 {
		t.Fatalf("want 1 event, got %d", len(doc.TraceEvents))
	}
	ev := doc.TraceEvents[0]
	if ev.Name != "/teapot" {
		t.Errorf("name=%q want /teapot", ev.Name)
	}
	if ev.Phase != "X" {
		t.Errorf("phase=%q want X", ev.Phase)
	}
	if status, _ := ev.Args["status"].(float64); int(status) != http.StatusTeapot {
		t.Errorf("status=%v want %d", ev.Args["status"], http.StatusTeapot)
	}
}
