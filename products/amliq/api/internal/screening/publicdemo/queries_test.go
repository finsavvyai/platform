package publicdemo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// expectations is the per-query block from test-queries.json. Keep field
// list aligned with the JSON schema (queries/test-queries.json).
type expectations struct {
	MinMatches          int      `json:"min_matches,omitempty"`
	MaxMatches          int      `json:"max_matches,omitempty"`
	MinTopConfidence    float64  `json:"min_top_confidence,omitempty"`
	MaxTopConfidence    float64  `json:"max_top_confidence,omitempty"`
	RiskLevel           string   `json:"risk_level,omitempty"`
	RiskLevelIn         []string `json:"risk_level_in,omitempty"`
	ListIDs             []string `json:"list_ids,omitempty"`
	LayersPresent       []string `json:"layers_present,omitempty"`
	PEPStatusRequired   bool     `json:"pep_status_required,omitempty"`
	PEPPositionContains string   `json:"pep_position_contains,omitempty"`
}

type queryCase struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Lists     []string     `json:"lists,omitempty"`
	PEP       bool         `json:"pep,omitempty"`
	Threshold float64      `json:"threshold,omitempty"`
	Expected  expectations `json:"expected"`
}

type queryFile struct {
	Queries []queryCase `json:"queries"`
}

func loadQueryCases(t *testing.T) []queryCase {
	t.Helper()
	path := filepath.Join(fixturesRoot(t), "queries", "test-queries.json")
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read queries: %v", err)
	}
	var qf queryFile
	if err := json.Unmarshal(b, &qf); err != nil {
		t.Fatalf("parse queries: %v", err)
	}
	if len(qf.Queries) == 0 {
		t.Fatal("no queries in fixture")
	}
	return qf.Queries
}

func TestPublicDemo_AllFixtureQueries(t *testing.T) {
	h := newTestHandler(t)
	cases := loadQueryCases(t)
	if len(cases) < 28 {
		t.Fatalf("expected ≥28 fixture queries, got %d", len(cases))
	}
	for _, tc := range cases {
		t.Run(tc.ID, func(t *testing.T) {
			body, _ := json.Marshal(map[string]interface{}{
				"name":      tc.Name,
				"lists":     tc.Lists,
				"pep":       tc.PEP,
				"threshold": tc.Threshold,
			})
			w := postJSON(t, h, string(body))
			if w.Code != 200 {
				t.Fatalf("%s: HTTP %d (%s)", tc.ID, w.Code, w.Body.String())
			}
			resp := decodeResp(t, w)
			checkExpectations(t, tc, resp)
		})
	}
}

// TestPublicDemo_VladimirPutinSampleResponse prints the canonical
// httptest response JSON, used by the verification report. Run with
// `go test -run TestPublicDemo_VladimirPutinSampleResponse -v` to see
// the pretty JSON.
func TestPublicDemo_VladimirPutinSampleResponse(t *testing.T) {
	h := newTestHandler(t)
	w := postJSON(t, h, `{"name":"Vladimir Putin"}`)
	if w.Code != 200 {
		t.Fatalf("want 200, got %d", w.Code)
	}
	if testing.Verbose() {
		fmt.Println(string(prettyJSON(w.Body.Bytes())))
	}
}

func prettyJSON(in []byte) []byte {
	var v interface{}
	if err := json.Unmarshal(in, &v); err != nil {
		return in
	}
	out, _ := json.MarshalIndent(v, "", "  ")
	return out
}
