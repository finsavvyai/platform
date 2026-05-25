package ingestion

import "testing"

// TestUKOFSIParser_MetadataPreamble guards against regression of the
// header-detection bug where the parser treated the metadata preamble
// row ("Last Updated,<date>") as the CSV header, making every row
// below it fail to parse. The real header lives on the second line
// and must be anchored on the "Name 6" column.
func TestUKOFSIParser_MetadataPreamble(t *testing.T) {
	preamble := "Last Updated,27/01/2026\n"
	data := []byte(preamble + ukOFSITestHeader +
		"SMITH,John,,,,,,,,,,United Kingdom,,,,,,,,,,,,Individual," +
		"Primary name variation,Russia,09/12/2022,09/12/2022,99999\n")

	parser := NewUKOFSIParser()
	entities, err := parser.Parse(data)
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(entities) != 1 {
		t.Fatalf("got %d entities, want 1", len(entities))
	}
	if got := entities[0].PrimaryName().String(); got != "John SMITH" {
		t.Errorf("name = %q, want %q", got, "John SMITH")
	}
	if entities[0].ListID != "uk_ofsi" {
		t.Errorf("listID = %q, want uk_ofsi", entities[0].ListID)
	}
}

// TestUKOFSIParser_ModernHeaderColumns ensures newer OFSI column
// names ("Passport Number", "National Identification Number") are
// read when the legacy columns are absent.
func TestUKOFSIParser_ModernHeaderColumns(t *testing.T) {
	header := "Name 6,Name 1,Name 2,Name 3,Name 4,Name 5,Title," +
		"DOB,Town of Birth,Country of Birth,Nationality," +
		"Passport Number,Passport Details," +
		"National Identification Number,National Identification Details," +
		"Position,Address 1,Address 2,Address 3,Address 4,Address 5," +
		"Address 6,Post/Zip Code,Country,Other Information,Group Type," +
		"Alias Type,Regime,Listed On,Last Updated,Group ID\n"
	row := "DOE,Jane,,,,,,,,,,PASS123,,NI-42,,,,,,,,,,,,Individual,," +
		"Russia,09/12/2022,09/12/2022,12345\n"

	parser := NewUKOFSIParser()
	entities, err := parser.Parse([]byte(header + row))
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(entities) != 1 {
		t.Fatalf("got %d entities, want 1", len(entities))
	}
	ent := entities[0]
	if len(ent.Identifiers) < 2 {
		t.Fatalf("want >=2 identifiers (passport + national id), got %d",
			len(ent.Identifiers))
	}
	if v := ent.Metadata["passport"]; v != "PASS123" {
		t.Errorf("passport meta = %q, want PASS123", v)
	}
	if v := ent.Metadata["ni_number"]; v != "NI-42" {
		t.Errorf("ni_number meta = %q, want NI-42", v)
	}
}
