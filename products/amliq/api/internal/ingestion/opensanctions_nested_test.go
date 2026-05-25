package ingestion

import (
	"testing"
)

func TestOpenSanctionsNestedParser(t *testing.T) {
	line := `{"id":"Q123","caption":"Jane Roe","schema":"Person",` +
		`"properties":{"birthDate":["1975-03-02"],"gender":["female"],` +
		`"passportNumber":["P987"],"email":["a@x.test"]},` +
		`"datasets":["us_ofac_sdn","eu_fsf"],"first_seen":"2020-01-01",` +
		`"last_seen":"2024-02-02","last_change":"2024-02-03",` +
		`"referents":["ofac-sdn-123"]}`
	blank := "\n"
	bad := `{"id":"","caption":"nope"}`
	data := []byte(line + "\n" + blank + "\n" + bad + "\n")

	p := NewOpenSanctionsNestedParser()
	ents, err := p.Parse(data)
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(ents) != 1 {
		t.Fatalf("want 1 entity, got %d", len(ents))
	}
	ent := ents[0]

	if got, _ := ent.Metadata["dataset"].(string); got != "us_ofac_sdn, eu_fsf" {
		t.Errorf("dataset = %q, want us_ofac_sdn, eu_fsf", got)
	}
	if ds, _ := ent.Metadata["datasets"].([]interface{}); len(ds) != 2 {
		t.Errorf("datasets = %v, want 2 entries", ent.Metadata["datasets"])
	}
	if refs, _ := ent.Metadata["referents"].([]interface{}); len(refs) != 1 {
		t.Errorf("referents = %v, want 1 entry", ent.Metadata["referents"])
	}
	if got, _ := ent.Metadata["schemaType"].(string); got != "Person" {
		t.Errorf("schemaType = %q, want Person", got)
	}
	if got, _ := ent.Metadata["first_seen"].(string); got != "2020-01-01" {
		t.Errorf("first_seen = %q, want 2020-01-01", got)
	}
	if got, _ := ent.Metadata["gender"].(string); got != "female" {
		t.Errorf("gender = %q, want female", got)
	}
	if ent.DOB == nil {
		t.Error("DOB not parsed")
	}
	if len(ent.Identifiers) != 1 {
		t.Errorf("identifiers = %d, want 1", len(ent.Identifiers))
	}
}

func TestPickNestedName(t *testing.T) {
	tests := []struct {
		name string
		row  nestedRow
		want string
	}{
		{"caption wins", nestedRow{Caption: "Alpha",
			Properties: map[string][]string{"name": {"Beta"}}}, "Alpha"},
		{"fallback to name prop", nestedRow{
			Properties: map[string][]string{"name": {"Beta"}}}, "Beta"},
		{"empty", nestedRow{}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := pickNestedName(tt.row); got != tt.want {
				t.Errorf("pickNestedName = %q, want %q", got, tt.want)
			}
		})
	}
}
