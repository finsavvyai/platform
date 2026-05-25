package ingestion

import "testing"

// runUKOFSICase executes one ukOFSICase through the real parser
// and asserts the expected fields.
func runUKOFSICase(t *testing.T, tc ukOFSICase) {
	t.Helper()
	data := []byte(ukOFSITestHeader + tc.row)
	parser := NewUKOFSIParser()
	entities, err := parser.Parse(data)
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(entities) != tc.wantN {
		t.Fatalf("got %d entities, want %d", len(entities), tc.wantN)
	}
	if tc.wantN == 0 {
		return
	}
	ent := entities[0]
	if tc.wantType != 0 && ent.Type != tc.wantType {
		t.Errorf("type = %v, want %v", ent.Type, tc.wantType)
	}
	if tc.wantName != "" {
		if got := ent.PrimaryName().String(); got != tc.wantName {
			t.Errorf("name = %q, want %q", got, tc.wantName)
		}
	}
	if tc.wantList != "" && ent.ListID != tc.wantList {
		t.Errorf("listID = %q, want %q", ent.ListID, tc.wantList)
	}
	if tc.checkIDLen > 0 && len(ent.Identifiers) == 0 {
		t.Errorf("expected Identifiers, got none")
	}
	if tc.wantDataset != "" {
		if v := ent.Metadata["dataset"]; v != tc.wantDataset {
			t.Errorf("dataset = %v, want %v", v, tc.wantDataset)
		}
	}
	if tc.wantPrograms != "" {
		if v := ent.Metadata["programs"]; v != tc.wantPrograms {
			t.Errorf("programs = %v, want %v", v, tc.wantPrograms)
		}
	}
}
