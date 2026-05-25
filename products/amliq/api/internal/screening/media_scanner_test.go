package screening

import (
	"context"
	"testing"
)

func TestMediaScannerScanEntity(t *testing.T) {
	tests := []struct {
		name     string
		llmResp  string
		entity   string
		wantHits int
		wantErr  bool
	}{
		{
			"adverse hits found",
			`{"hits":[{"title":"Fraud case","source":"reuters.com","snippet":"accused of fraud","categories":["fraud"],"risk_score":0.8}],"summary":"one hit"}`,
			"John Doe",
			1,
			false,
		},
		{
			"clean entity",
			`{"hits":[],"summary":"no adverse media found"}`,
			"Clean Person",
			0,
			false,
		},
		{
			"multiple hits",
			`{"hits":[{"title":"ML scheme","source":"bbc.com","snippet":"laundering","categories":["money_laundering"],"risk_score":0.9},{"title":"Tax evasion","source":"ft.com","snippet":"evaded taxes","categories":["tax_evasion"],"risk_score":0.6}],"summary":"two findings"}`,
			"Bad Actor",
			2,
			false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scanner := NewMediaScanner(&mockLLM{response: tt.llmResp})
			hits, err := scanner.ScanEntity(context.Background(), tt.entity)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if len(hits) != tt.wantHits {
				t.Errorf("got %d hits, want %d", len(hits), tt.wantHits)
			}
		})
	}
}

func TestMediaScannerClassifyArticle(t *testing.T) {
	tests := []struct {
		name      string
		llmResp   string
		wantCats  int
		wantScore float64
	}{
		{
			"fraud article",
			`{"categories":["fraud","money_laundering"],"risk_score":0.85}`,
			2, 0.85,
		},
		{
			"clean article",
			`{"categories":[],"risk_score":0.0}`,
			0, 0.0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scanner := NewMediaScanner(&mockLLM{response: tt.llmResp})
			cats, score, err := scanner.ClassifyArticle(
				context.Background(), "Title", "Snippet",
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(cats) != tt.wantCats {
				t.Errorf("categories = %d, want %d", len(cats), tt.wantCats)
			}
			if score != tt.wantScore {
				t.Errorf("score = %f, want %f", score, tt.wantScore)
			}
		})
	}
}
