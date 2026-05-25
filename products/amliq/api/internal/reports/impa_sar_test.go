package reports

import (
	"encoding/xml"
	"strings"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func mkScreenResp(t *testing.T) *domain.ScreenResponse {
	t.Helper()
	tid, err := domain.NewTenantID("tnt_aaaaaaaaaaaa")
	if err != nil {
		t.Fatalf("tenant: %v", err)
	}
	name, _ := domain.NewName("Yossi Cohen", "", "", "he")
	eid, _ := domain.NewEntityID("entity_test_001")
	ent, _ := domain.NewEntity(eid,
		domain.EntityTypeIndividual, []domain.Name{name})
	ent.Metadata["country"] = "IL"
	req, err := domain.NewScreenRequest(tid, ent)
	if err != nil {
		t.Fatalf("req: %v", err)
	}
	resp := domain.NewScreenResponse(req)
	resp.Matches = []domain.MatchResult{
		{
			EntityID:     eid,
			Confidence:   domain.Confidence{},
			ListID:       "israeli_nbctf_individuals",
			TimestampHit: time.Now(),
		},
	}
	return &resp
}

func TestBuildImpaSARProducesValidXML(t *testing.T) {
	resp := mkScreenResp(t)
	sar, err := BuildImpaSAR(resp)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if sar.XMLNS != "http://amliq.ai/schema/sar/v1" {
		t.Errorf("xmlns: got %q", sar.XMLNS)
	}
	if sar.Header.ReportType != "411" {
		t.Errorf("reportType: got %q want 411", sar.Header.ReportType)
	}
	if sar.Subject.Name == "" {
		t.Error("subject name empty")
	}
	if sar.Activ.MatchedLists != "israeli_nbctf_individuals" {
		t.Errorf("matched lists: got %q",
			sar.Activ.MatchedLists)
	}
	out, err := MarshalImpaSAR(sar)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	// Round-trip must parse — proves the emitted XML is well-formed.
	var rt ImpaSAR
	if err := xml.Unmarshal(out, &rt); err != nil {
		t.Fatalf("round-trip: %v\n%s", err, out)
	}
	if !strings.HasPrefix(string(out), "<?xml") {
		t.Error("xml header missing")
	}
}

func TestBuildImpaSARRejectsNil(t *testing.T) {
	if _, err := BuildImpaSAR(nil); err == nil {
		t.Error("want error on nil screening")
	}
}

func TestClassifyImpaRiskBuckets(t *testing.T) {
	tests := []struct {
		score float64
		want  string
	}{
		{0.95, "critical"},
		{0.80, "high"},
		{0.60, "medium"},
		{0.30, "low"},
	}
	for _, tt := range tests {
		if got := classifyImpaRisk(tt.score); got != tt.want {
			t.Errorf("score %.2f: got %q want %q",
				tt.score, got, tt.want)
		}
	}
}
