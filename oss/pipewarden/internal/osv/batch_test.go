package osv

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestQueryBatchReturnsAlignedResults(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var got batchRequest
		_ = json.Unmarshal(body, &got)
		if len(got.Queries) != 2 {
			t.Fatalf("expected 2 queries, got %d", len(got.Queries))
		}
		_, _ = w.Write([]byte(`{"results":[{"vulns":[{"id":"GHSA-a","summary":"a"}]},{"vulns":[]}]}`))
	}))
	defer srv.Close()

	c := NewClient(WithEndpoint(srv.URL))
	results, err := c.QueryBatch(context.Background(), []PackageQuery{
		{EcoNPM, "lodash", "4.17.20"},
		{EcoGo, "github.com/safe/pkg", "v1.0.0"},
	})
	if err != nil {
		t.Fatalf("QueryBatch: %v", err)
	}
	if len(results) != 2 || len(results[0]) != 1 || results[0][0].ID != "GHSA-a" {
		t.Fatalf("unexpected results: %+v", results)
	}
	if len(results[1]) != 0 {
		t.Fatalf("expected empty second result, got %+v", results[1])
	}
}

func TestQueryBatchEmptyInput(t *testing.T) {
	results, err := NewClient().QueryBatch(context.Background(), nil)
	if err != nil {
		t.Fatalf("QueryBatch: %v", err)
	}
	if results != nil {
		t.Fatalf("expected nil results, got %+v", results)
	}
}
