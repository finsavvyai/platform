package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"
)

// newTestServer builds an httptest server that responds to the three
// GitHub REST endpoints we hit. Kept minimal so tests stay readable.
func newTestServer(t *testing.T, dispatches *[]map[string]interface{}) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/dispatches"):
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			*dispatches = append(*dispatches, body)
			w.WriteHeader(http.StatusNoContent)
		case strings.Contains(r.URL.Path, "/runs/"):
			_ = json.NewEncoder(w).Encode(workflowRun{ID: 42, RunNumber: 7, HTMLURL: "https://x/7",
				Status: "completed", Conclusion: "success"})
		case strings.HasSuffix(r.URL.Path, "/runs"):
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"workflow_runs": []workflowRun{{ID: 42, RunNumber: 7, HTMLURL: "https://x/7"}},
			})
		case strings.HasSuffix(r.URL.Path, "/workflows"):
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"workflows": []workflow{{ID: 1, Name: "CI", Path: ".github/workflows/ci.yml", State: "active"}},
			})
		default:
			w.WriteHeader(404)
		}
	}))
}

func TestTrigger_DispatchSingle(t *testing.T) {
	var dispatches []map[string]interface{}
	srv := newTestServer(t, &dispatches)
	defer srv.Close()
	c := &triggerClient{http: srv.Client(), token: "t", base: srv.URL}
	if err := c.dispatch(context.Background(), "o", "r", "ci.yml", "main",
		map[string]string{"env": "staging"}); err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if len(dispatches) != 1 {
		t.Fatalf("want 1 dispatch, got %d", len(dispatches))
	}
	if dispatches[0]["ref"] != "main" {
		t.Errorf("ref: got %v", dispatches[0]["ref"])
	}
	inputs := dispatches[0]["inputs"].(map[string]interface{})
	if inputs["env"] != "staging" {
		t.Errorf("inputs: got %v", inputs)
	}
}

func TestTrigger_ListWorkflows(t *testing.T) {
	srv := newTestServer(t, &[]map[string]interface{}{})
	defer srv.Close()
	c := &triggerClient{http: srv.Client(), token: "t", base: srv.URL}
	wfs, err := c.listWorkflows(context.Background(), "o", "r")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(wfs) != 1 || wfs[0].Name != "CI" {
		t.Errorf("unexpected workflows: %+v", wfs)
	}
}

func TestTrigger_ExpandMatrix(t *testing.T) {
	cells := expandMatrix(map[string]string{"env": "dev,prod", "v": "1"})
	if len(cells) != 2 {
		t.Fatalf("want 2 cells, got %d: %v", len(cells), cells)
	}
	got := []string{}
	for _, c := range cells {
		got = append(got, c["env"]+"/"+c["v"])
	}
	sort.Strings(got)
	want := []string{"dev/1", "prod/1"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("cells: got %v want %v", got, want)
	}
}

func TestTrigger_ParseFlags(t *testing.T) {
	opts, err := parseTriggerFlags([]string{"ci.yml", "--ref", "dev", "--input", "a=1", "--input", "b=2"})
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if opts.Workflow != "ci.yml" || opts.Ref != "dev" {
		t.Errorf("opts: %+v", opts)
	}
	if opts.Inputs["a"] != "1" || opts.Inputs["b"] != "2" {
		t.Errorf("inputs: %+v", opts.Inputs)
	}
}

func TestTrigger_InputFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "i.json")
	_ = os.WriteFile(path, []byte(`{"env":"file","v":"9"}`), 0644)
	opts, err := parseTriggerFlags([]string{"ci.yml", "--input-file", path, "--input", "env=cli"})
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if opts.Inputs["env"] != "cli" { // inline wins
		t.Errorf("inline override failed: %v", opts.Inputs)
	}
	if opts.Inputs["v"] != "9" {
		t.Errorf("file value lost: %v", opts.Inputs)
	}
}

func TestTrigger_WatchSuccess(t *testing.T) {
	srv := newTestServer(t, &[]map[string]interface{}{})
	defer srv.Close()
	c := &triggerClient{http: srv.Client(), token: "t", base: srv.URL}
	old := watchPollInterval
	watchPollInterval = 10 * time.Millisecond
	defer func() { watchPollInterval = old }()
	if err := watchRun(context.Background(), c, "o", "r", 42); err != nil {
		t.Errorf("watch: %v", err)
	}
}

func TestTrigger_DetectRepo(t *testing.T) {
	for _, in := range []string{
		"git@github.com:finsavvyai/pushci.git",
		"https://github.com/finsavvyai/pushci",
		"https://github.com/finsavvyai/pushci.git",
	} {
		m := repoRegex.FindStringSubmatch(in)
		if len(m) < 3 || m[1] != "finsavvyai" {
			t.Errorf("repoRegex failed on %q: %v", in, m)
		}
	}
}

func TestTrigger_NoWorkflow(t *testing.T) {
	if _, err := parseTriggerFlags([]string{"--ref", "main"}); err == nil {
		t.Error("expected error for missing workflow")
	}
}
