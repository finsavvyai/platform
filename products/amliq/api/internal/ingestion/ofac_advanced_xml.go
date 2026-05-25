package ingestion

import (
	"bytes"
	"encoding/xml"
	"io"

	"github.com/aegis-aml/aegis/internal/domain"
)

// OFACAdvancedParser parses the OFAC Advanced SDN XML feed.
// Source: https://www.treasury.gov/ofac/downloads/sdn_advanced.xml
type OFACAdvancedParser struct{}

func NewOFACAdvancedParser() *OFACAdvancedParser {
	return &OFACAdvancedParser{}
}

func (p *OFACAdvancedParser) Parse(data []byte) ([]domain.Entity, error) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	var entities []domain.Entity

	for {
		token, err := decoder.Token()
		if err != nil {
			break
		}

		if se, ok := token.(xml.StartElement); ok && se.Name.Local == "sdnEntry" {
			var entry advSDNEntry
			if err := decoder.DecodeElement(&entry, &se); err == nil {
				if ent, ok := parseAdvEntry(entry); ok {
					entities = append(entities, ent)
				}
			}
		}
	}

	return entities, nil
}

// ParseStream implements StreamParser for the OFAC Advanced SDN XML feed.
// Memory: one sdnEntry at a time.
func (p *OFACAdvancedParser) ParseStream(
	r io.Reader, emit EntityEmitter,
) error {
	decoder := xml.NewDecoder(r)
	for {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		se, ok := token.(xml.StartElement)
		if !ok || se.Name.Local != "sdnEntry" {
			continue
		}
		var entry advSDNEntry
		if err := decoder.DecodeElement(&entry, &se); err != nil {
			continue
		}
		if ent, ok := parseAdvEntry(entry); ok {
			if err := emit(ent); err != nil {
				return err
			}
		}
	}
	return nil
}
