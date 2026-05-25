package ingestion

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubParser struct {
	entities []domain.Entity
	err      error
}

func (s *stubParser) Parse(data []byte) ([]domain.Entity, error) {
	return s.entities, s.err
}

func TestPipelineFull(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("data"))
	}))
	defer srv.Close()

	id, _ := domain.NewEntityID("ent_aaaaaaaaaaaa")
	name, _ := domain.NewName("John Doe", "", "", "")
	ent, _ := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})

	tests := []struct {
		name       string
		sources    []PipelineSource
		wantCount  int
		wantErrors int
	}{
		{
			name: "processes_multiple_sources",
			sources: []PipelineSource{
				{ID: "src1", URL: srv.URL, Parser: &stubParser{entities: []domain.Entity{ent}}},
				{ID: "src2", URL: srv.URL, Parser: &stubParser{entities: []domain.Entity{ent, ent}}},
			},
			wantCount:  2,
			wantErrors: 0,
		},
		{
			name: "continues_after_failure",
			sources: []PipelineSource{
				{ID: "bad", URL: "", Parser: &stubParser{}},
				{ID: "good", URL: srv.URL, Parser: &stubParser{entities: []domain.Entity{ent}}},
			},
			wantCount:  1,
			wantErrors: 1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rf := NewResilientFetcher()
			rf.backoff = time.Millisecond
			ht := NewHealthTracker()
			p := NewPipeline(rf, ht, tt.sources)
			res, err := p.RunFull(context.Background())
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.SourcesProcessed != tt.wantCount {
				t.Errorf("processed=%d, want=%d", res.SourcesProcessed, tt.wantCount)
			}
			if len(res.Errors) != tt.wantErrors {
				t.Errorf("errors=%d, want=%d", len(res.Errors), tt.wantErrors)
			}
		})
	}
}

func TestPipelineDelta(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("delta"))
	}))
	defer srv.Close()

	rf := NewResilientFetcher()
	rf.backoff = time.Millisecond
	ht := NewHealthTracker()
	sources := []PipelineSource{
		{ID: "s1", URL: srv.URL, Parser: &stubParser{}},
	}
	p := NewPipeline(rf, ht, sources)
	res, err := p.RunDelta(context.Background(), time.Now().Add(-time.Hour))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.SourcesProcessed != 1 {
		t.Errorf("delta processed=%d, want=1", res.SourcesProcessed)
	}
}
