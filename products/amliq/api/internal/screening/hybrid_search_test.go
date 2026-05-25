package screening

import (
	"math"
	"testing"
)

func TestReciprocalRankFusion(t *testing.T) {
	tests := []struct {
		name      string
		dense     []SearchResult
		sparse    []SearchResult
		topK      int
		k         int
		wantFirst string
		wantLen   int
	}{
		{
			name: "both lists have same top entity",
			dense: []SearchResult{
				{EntityID: "e1", Score: 0.9, Source: "dense", ListSource: "OFAC"},
				{EntityID: "e2", Score: 0.7, Source: "dense", ListSource: "EU"},
			},
			sparse: []SearchResult{
				{EntityID: "e1", Score: 0.85, Source: "sparse", ListSource: "OFAC"},
				{EntityID: "e3", Score: 0.6, Source: "sparse", ListSource: "UN"},
			},
			topK: 3, k: 60, wantFirst: "e1", wantLen: 3,
		},
		{
			name: "disjoint results",
			dense: []SearchResult{
				{EntityID: "d1", Score: 0.9, Source: "dense", ListSource: "OFAC"},
			},
			sparse: []SearchResult{
				{EntityID: "s1", Score: 0.8, Source: "sparse", ListSource: "EU"},
			},
			topK: 5, k: 60, wantLen: 2,
		},
		{
			name:    "empty inputs",
			dense:   nil,
			sparse:  nil,
			topK:    10,
			k:       60,
			wantLen: 0,
		},
		{
			name: "topK truncation",
			dense: []SearchResult{
				{EntityID: "a", Source: "dense"},
				{EntityID: "b", Source: "dense"},
				{EntityID: "c", Source: "dense"},
			},
			sparse: []SearchResult{
				{EntityID: "d", Source: "sparse"},
				{EntityID: "e", Source: "sparse"},
			},
			topK: 2, k: 60, wantLen: 2,
		},
		{
			name: "fused entity has higher score than either alone",
			dense: []SearchResult{
				{EntityID: "x", Score: 0.5, Source: "dense", ListSource: "UN"},
			},
			sparse: []SearchResult{
				{EntityID: "x", Score: 0.5, Source: "sparse", ListSource: "UN"},
				{EntityID: "y", Score: 0.9, Source: "sparse", ListSource: "EU"},
			},
			topK: 2, k: 60, wantFirst: "x", wantLen: 2,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ReciprocalRankFusion(tt.dense, tt.sparse, tt.topK, tt.k)
			if len(got) != tt.wantLen {
				t.Fatalf("len = %d, want %d", len(got), tt.wantLen)
			}
			if tt.wantFirst != "" && len(got) > 0 && got[0].EntityID != tt.wantFirst {
				t.Fatalf("first = %s, want %s", got[0].EntityID, tt.wantFirst)
			}
			for _, r := range got {
				if r.Source != "fused" {
					t.Fatalf("source = %s, want fused", r.Source)
				}
				if math.IsNaN(r.Score) || r.Score <= 0 {
					t.Fatalf("invalid score %f", r.Score)
				}
			}
		})
	}
}
