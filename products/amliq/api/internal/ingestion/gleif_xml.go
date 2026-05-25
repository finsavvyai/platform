package ingestion

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"

	"github.com/aegis-aml/aegis/internal/domain"
)

// GLEIFXMLParser parses the LEI-CDF 3.1 concatenated XML emitted by
// the GLEIF Golden Copy feed. Streaming — memory is bounded by one
// <LEIRecord> at a time regardless of source size (~8GB decompressed).
type GLEIFXMLParser struct{}

// NewGLEIFXMLParser creates the parser.
func NewGLEIFXMLParser() *GLEIFXMLParser { return &GLEIFXMLParser{} }

// gleifXMLRecord mirrors the subset of LEI-CDF we surface. The
// schema nests Entity/LegalName under LEIRecord; we pick the
// minimum needed to build a domain.Entity + a few meta fields.
type gleifXMLRecord struct {
	LEI    string `xml:"LEI"`
	Entity struct {
		LegalName    string `xml:"LegalName"`
		Jurisdiction string `xml:"LegalJurisdiction"`
		Category     string `xml:"EntityCategory"`
		LegalAddress struct {
			FirstAddressLine string `xml:"FirstAddressLine"`
			City             string `xml:"City"`
			Country          string `xml:"Country"`
			PostalCode       string `xml:"PostalCode"`
		} `xml:"LegalAddress"`
	} `xml:"Entity"`
	Registration struct {
		Status         string `xml:"RegistrationStatus"`
		InitialDate    string `xml:"InitialRegistrationDate"`
		LastUpdateDate string `xml:"LastUpdateDate"`
	} `xml:"Registration"`
}

// ParseStream decodes the LEI-CDF XML stream token-by-token and
// emits one domain.Entity per <LEIRecord>. Implements StreamParser
// so the reingest pipeline can pipe zip → parser → batched upsert
// without materialising the whole tree.
func (p *GLEIFXMLParser) ParseStream(r io.Reader, emit EntityEmitter) error {
	dec := xml.NewDecoder(r)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("xml token: %w", err)
		}
		se, ok := tok.(xml.StartElement)
		if !ok || se.Name.Local != "LEIRecord" {
			continue
		}
		var rec gleifXMLRecord
		if err := dec.DecodeElement(&rec, &se); err != nil {
			continue // skip malformed rows
		}
		ent, ok := buildGLEIFXMLEntity(rec)
		if !ok {
			continue
		}
		if err := emit(ent); err != nil {
			return err
		}
	}
}

// Parse is the buffered fallback required by the Parser interface.
// Large Golden Copy feeds should route through ParseStream.
func (p *GLEIFXMLParser) Parse(data []byte) ([]domain.Entity, error) {
	var out []domain.Entity
	err := p.ParseStream(bytes.NewReader(data), func(e domain.Entity) error {
		out = append(out, e)
		return nil
	})
	return out, err
}
