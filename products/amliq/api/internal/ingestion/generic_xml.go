package ingestion

import (
	"encoding/xml"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// XMLListConfig defines how to parse an XML-formatted sanctions list.
type XMLListConfig struct {
	ListID      string
	EntityTag   string            // XML element name for entities
	FieldMap    map[string]string // our_field -> xml_element
}

// GenericXMLParser parses any XML sanctions list using config.
type GenericXMLParser struct {
	config XMLListConfig
}

func NewGenericXMLParser(cfg XMLListConfig) *GenericXMLParser {
	return &GenericXMLParser{config: cfg}
}

func (p *GenericXMLParser) Parse(data []byte) ([]domain.Entity, error) {
	decoder := xml.NewDecoder(strings.NewReader(string(data)))
	var entities []domain.Entity
	var current map[string]string
	var currentTag string
	inEntity := false

	for {
		tok, err := decoder.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == p.config.EntityTag {
				inEntity = true
				current = make(map[string]string)
				for _, attr := range t.Attr {
					current[attr.Name.Local] = attr.Value
				}
			} else if inEntity {
				currentTag = t.Name.Local
			}
		case xml.CharData:
			if inEntity && currentTag != "" {
				current[currentTag] = strings.TrimSpace(string(t))
			}
		case xml.EndElement:
			if t.Name.Local == p.config.EntityTag && inEntity {
				if ent, ok := p.buildEntity(current); ok {
					entities = append(entities, ent)
				}
				inEntity = false
				current = nil
			}
			currentTag = ""
		}
	}
	return entities, nil
}

func (p *GenericXMLParser) buildEntity(fields map[string]string) (domain.Entity, bool) {
	nameField := p.config.FieldMap["name"]
	idField := p.config.FieldMap["id"]

	fullName := fields[nameField]
	listID := fields[idField]
	if fullName == "" || listID == "" {
		return domain.Entity{}, false
	}

	id, _ := domain.NewEntityID("ent_" + sanitizeID(listID))
	name, _ := domain.NewName(NormalizeName(fullName), "", "", "")
	ent, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = p.config.ListID
	return ent, true
}
