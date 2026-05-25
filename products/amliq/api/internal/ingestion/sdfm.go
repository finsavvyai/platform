package ingestion

import (
	"encoding/xml"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SDFMParser parses the Ukrainian SDFM sanctions XML.
// Uses acount-list / aka-list structure; type-aka "N" = primary name.
type SDFMParser struct{}

func NewSDFMParser() *SDFMParser {
	return &SDFMParser{}
}

func (sp *SDFMParser) Parse(data []byte) ([]domain.Entity, error) {
	data = stripBOM(data)

	var root sdfmRoot
	if err := xml.Unmarshal(data, &root); err != nil {
		return nil, err
	}

	var entities []domain.Entity
	for _, rec := range root.Records {
		ent, ok := rec.toEntity()
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

type sdfmRoot struct {
	XMLName xml.Name     `xml:"consolidated-list"`
	Records []sdfmRecord `xml:"acount-list"`
}

type sdfmRecord struct {
	NumberEntry string    `xml:"number-entry"`
	Program     string    `xml:"program-entry"`
	DOB         string    `xml:"date-of-birth-list"`
	Comments    string    `xml:"comments"`
	Address     string    `xml:"address"`
	Nationality string    `xml:"nationality-list"`
	TypeEntry   string    `xml:"type-entry"`
	AkaList     []sdfmAka `xml:"aka-list"`
}

type sdfmAka struct {
	Name1 string `xml:"aka-name1"`
	Name2 string `xml:"aka-name2"`
	Name3 string `xml:"aka-name3"`
	Name4 string `xml:"aka-name4"`
	Type  string `xml:"type-aka"`
}
