package ingestion

import "testing"

// TestFTMParser_BirthDateFromProps proves FTM JSON lifts DOB coverage
// by surfacing birthDate out of the property map — the exact coverage
// path that targets.simple.csv cannot provide.
func TestFTMParser_BirthDateFromProps(t *testing.T) {
	line := `{"id":"NK-x1","caption":"Jane Doe","schema":"Person",` +
		`"datasets":["peps"],"first_seen":"2026-01-01",` +
		`"last_seen":"2026-04-01","last_change":"2026-03-01",` +
		`"properties":{"birthDate":["1970-05-15"],` +
		`"nationality":["us"],"position":["Minister"],` +
		`"gender":["female"],"birthPlace":["Boston"],` +
		`"passportNumber":["P123"],"idNumber":["SSN-9"]}}`

	parser := NewOpenSanctionsPEPFTMParser()
	entities, err := parser.Parse([]byte(line + "\n"))
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(entities) != 1 {
		t.Fatalf("got %d entities, want 1", len(entities))
	}
	ent := entities[0]
	if ent.DOB == nil {
		t.Fatalf("DOB nil, want parsed 1970-05-15")
	}
	if ent.Gender != "female" {
		t.Errorf("Gender=%q want female", ent.Gender)
	}
	if ent.PositionTitle != "Minister" {
		t.Errorf("PositionTitle=%q want Minister", ent.PositionTitle)
	}
	if ent.PlaceOfBirth != "Boston" {
		t.Errorf("PlaceOfBirth=%q want Boston", ent.PlaceOfBirth)
	}
	if len(ent.Identifiers) < 2 {
		t.Errorf("Identifiers=%d want >=2", len(ent.Identifiers))
	}
	if ent.ListID != "opensanctions_peps" {
		t.Errorf("ListID=%q want opensanctions_peps", ent.ListID)
	}
}

// TestFTMParser_SkipsRelationSchemas drops Occupancy/Family/Address
// rows, which are relationship nodes rather than screenable targets.
func TestFTMParser_SkipsRelationSchemas(t *testing.T) {
	lines := `{"id":"a","caption":"x","schema":"Occupancy","properties":{}}
{"id":"b","caption":"y","schema":"Family","properties":{}}
{"id":"c","caption":"Bob Jones","schema":"Person","properties":{"name":["Bob Jones"]}}
`
	parser := NewOpenSanctionsPEPFTMParser()
	entities, err := parser.Parse([]byte(lines))
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(entities) != 1 {
		t.Fatalf("got %d entities, want 1 (Person only)", len(entities))
	}
	if entities[0].PrimaryName().String() != "Bob Jones" {
		t.Errorf("name=%q want Bob Jones", entities[0].PrimaryName().String())
	}
}

// TestFTMParser_IgnoresMalformedLines tolerates stray blank lines and
// partial JSON (so one bad line does not abort the whole feed).
func TestFTMParser_IgnoresMalformedLines(t *testing.T) {
	lines := "\n{bad json}\n" +
		`{"id":"ok","caption":"Alice","schema":"Person","properties":{}}` + "\n"
	parser := NewOpenSanctionsPEPFTMParser()
	entities, err := parser.Parse([]byte(lines))
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(entities) != 1 {
		t.Fatalf("got %d entities, want 1", len(entities))
	}
}
