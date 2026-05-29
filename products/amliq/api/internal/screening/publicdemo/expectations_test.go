package publicdemo

import (
	"strings"
	"testing"
)

// checkExpectations is the shared assertion driver for the
// fixture-backed integration test. Kept in a separate file purely to
// honour the 200-line cap on new code.
func checkExpectations(t *testing.T, tc queryCase, resp Response) {
	t.Helper()
	if tc.Expected.MinMatches > 0 && len(resp.Matches) < tc.Expected.MinMatches {
		t.Errorf("%s: want ≥%d matches, got %d",
			tc.ID, tc.Expected.MinMatches, len(resp.Matches))
	}
	if tc.Expected.MaxMatches > 0 && len(resp.Matches) > tc.Expected.MaxMatches {
		t.Errorf("%s: want ≤%d matches, got %d",
			tc.ID, tc.Expected.MaxMatches, len(resp.Matches))
	}
	top := topConfidence(resp.Matches)
	if tc.Expected.MinTopConfidence > 0 && top+0.05 < tc.Expected.MinTopConfidence {
		t.Errorf("%s: top confidence %.3f < %.3f-0.05",
			tc.ID, top, tc.Expected.MinTopConfidence)
	}
	if tc.Expected.MaxTopConfidence > 0 && top-0.05 > tc.Expected.MaxTopConfidence {
		t.Errorf("%s: top confidence %.3f > %.3f+0.05",
			tc.ID, top, tc.Expected.MaxTopConfidence)
	}
	checkRisk(t, tc, resp)
	checkLists(t, tc, resp)
	checkLayers(t, tc, resp)
	checkPEP(t, tc, resp)
}

func checkRisk(t *testing.T, tc queryCase, resp Response) {
	t.Helper()
	if tc.Expected.RiskLevel != "" && resp.RiskLevel != tc.Expected.RiskLevel {
		t.Errorf("%s: risk want %q got %q",
			tc.ID, tc.Expected.RiskLevel, resp.RiskLevel)
	}
	if len(tc.Expected.RiskLevelIn) > 0 {
		ok := false
		for _, r := range tc.Expected.RiskLevelIn {
			if resp.RiskLevel == r {
				ok = true
				break
			}
		}
		if !ok {
			t.Errorf("%s: risk %q not in %v",
				tc.ID, resp.RiskLevel, tc.Expected.RiskLevelIn)
		}
	}
}

func checkLists(t *testing.T, tc queryCase, resp Response) {
	t.Helper()
	if len(tc.Expected.ListIDs) == 0 {
		return
	}
	seen := map[string]bool{}
	for _, m := range resp.Matches {
		for _, l := range m.Lists {
			seen[strings.ToLower(l)] = true
		}
	}
	for _, want := range tc.Expected.ListIDs {
		if !seen[strings.ToLower(want)] {
			t.Errorf("%s: expected list %q in matches, got %v",
				tc.ID, want, mapKeys(seen))
		}
	}
}

func checkLayers(t *testing.T, tc queryCase, resp Response) {
	t.Helper()
	if len(tc.Expected.LayersPresent) == 0 {
		return
	}
	seen := map[string]bool{}
	for _, m := range resp.Matches {
		for _, l := range m.Layers {
			seen[l.Layer] = true
		}
	}
	for _, want := range tc.Expected.LayersPresent {
		if !seen[want] {
			t.Errorf("%s: expected layer %q in matches, got %v",
				tc.ID, want, mapKeys(seen))
		}
	}
}

func checkPEP(t *testing.T, tc queryCase, resp Response) {
	t.Helper()
	if !tc.Expected.PEPStatusRequired {
		return
	}
	var hit *Match
	for i := range resp.Matches {
		if resp.Matches[i].PEPStatus.Status != "none" {
			hit = &resp.Matches[i]
			break
		}
	}
	if hit == nil {
		t.Errorf("%s: expected at least one match with pepStatus != none", tc.ID)
		return
	}
	if tc.Expected.PEPPositionContains != "" &&
		!strings.Contains(hit.PEPStatus.Position, tc.Expected.PEPPositionContains) {
		t.Errorf("%s: pep position %q should contain %q",
			tc.ID, hit.PEPStatus.Position, tc.Expected.PEPPositionContains)
	}
}

func mapKeys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
