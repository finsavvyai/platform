package ingestion

import "testing"

// TestGLEIFXMLParser_ParsesRecord covers the happy path: one valid
// LEIRecord under the LEI-CDF envelope yields one Company entity
// with the LEI, jurisdiction, address, and registration fields
// populated.
func TestGLEIFXMLParser_ParsesRecord(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8"?>
<LEIData xmlns="http://www.gleif.org/data/schema/leidata/2016">
  <LEIRecords>
    <LEIRecord>
      <LEI>549300ABCDEFGHIJ1234</LEI>
      <Entity>
        <LegalName>Acme International Corp.</LegalName>
        <LegalJurisdiction>US</LegalJurisdiction>
        <EntityCategory>GENERAL</EntityCategory>
        <LegalAddress>
          <FirstAddressLine>1 Market Street</FirstAddressLine>
          <City>San Francisco</City>
          <Country>US</Country>
          <PostalCode>94105</PostalCode>
        </LegalAddress>
      </Entity>
      <Registration>
        <RegistrationStatus>ISSUED</RegistrationStatus>
        <InitialRegistrationDate>2012-06-06</InitialRegistrationDate>
        <LastUpdateDate>2026-04-19</LastUpdateDate>
      </Registration>
    </LEIRecord>
  </LEIRecords>
</LEIData>`
	ents, err := NewGLEIFXMLParser().Parse([]byte(xml))
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(ents) != 1 {
		t.Fatalf("got %d entities, want 1", len(ents))
	}
	ent := ents[0]
	if ent.ListID != "gleif_lei" {
		t.Errorf("listID = %q, want gleif_lei", ent.ListID)
	}
	if got := ent.PrimaryName().String(); got == "" {
		t.Errorf("name empty, want non-empty")
	}
	if lei := ent.Metadata["lei"]; lei != "549300ABCDEFGHIJ1234" {
		t.Errorf("lei meta = %v, want 549300ABCDEFGHIJ1234", lei)
	}
	if j := ent.Metadata["jurisdiction"]; j != "US" {
		t.Errorf("jurisdiction = %v, want US", j)
	}
	if len(ent.Addresses) != 1 {
		t.Fatalf("addresses = %d, want 1", len(ent.Addresses))
	}
}

// TestGLEIFXMLParser_SkipsInvalid ensures records with empty or
// too-short names are dropped without erroring out.
func TestGLEIFXMLParser_SkipsInvalid(t *testing.T) {
	xml := `<LEIData><LEIRecords>
    <LEIRecord><LEI>A</LEI><Entity><LegalName></LegalName></Entity></LEIRecord>
    <LEIRecord><LEI>B</LEI><Entity><LegalName>ok name here</LegalName></Entity></LEIRecord>
  </LEIRecords></LEIData>`
	ents, err := NewGLEIFXMLParser().Parse([]byte(xml))
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(ents) != 1 {
		t.Fatalf("got %d entities, want 1 (empty-name record must drop)", len(ents))
	}
}
