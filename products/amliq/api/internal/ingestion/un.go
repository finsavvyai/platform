package ingestion

import (
	"encoding/xml"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// UNParser parses the UN Consolidated Sanctions XML.
// Source: https://scsanctions.un.org/resources/xml/en/consolidated.xml
// Supports the consolidated format with INDIVIDUAL/ENTITY elements.
type UNParser struct{}

func NewUNParser() *UNParser {
	return &UNParser{}
}

func (up *UNParser) Parse(data []byte) ([]domain.Entity, error) {
	data = stripBOM(data)
	var consolidated unConsolidatedList
	if err := xml.Unmarshal(data, &consolidated); err != nil {
		return nil, fmt.Errorf("un xml parse: %w", err)
	}

	var entities []domain.Entity
	for _, ind := range consolidated.Individuals {
		if ent, ok := ind.toEntity(); ok {
			entities = append(entities, ent)
		}
	}
	for _, ent := range consolidated.Entities {
		if e, ok := ent.toEntity(); ok {
			entities = append(entities, e)
		}
	}
	return entities, nil
}

// unConsolidatedList is the root XML structure.
type unConsolidatedList struct {
	XMLName     xml.Name       `xml:"CONSOLIDATED_LIST"`
	Individuals []unIndividual `xml:"INDIVIDUALS>INDIVIDUAL"`
	Entities    []unEntityXML  `xml:"ENTITIES>ENTITY"`
}

// unIndividual represents an INDIVIDUAL element.
type unIndividual struct {
	DataID        string          `xml:"DATAID"`
	RefNumber     string          `xml:"REFERENCE_NUMBER"`
	FirstName     string          `xml:"FIRST_NAME"`
	SecondName    string          `xml:"SECOND_NAME"`
	ThirdName     string          `xml:"THIRD_NAME"`
	FourthName    string          `xml:"FOURTH_NAME"`
	NameOrig      string          `xml:"NAME_ORIGINAL_SCRIPT"`
	Designation   string          `xml:"DESIGNATION"`
	Title         string          `xml:"TITLE"`
	ListType      string          `xml:"UN_LIST_TYPE"`
	ListedOn      string          `xml:"LISTED_ON"`
	LastUpdated   string          `xml:"LAST_DAY_UPDATED"`
	Comments1     string          `xml:"COMMENTS1"`
	SubmittedBy   string          `xml:"SUBMITTED_BY"`
	Aliases       []unAlias       `xml:"INDIVIDUAL_ALIAS"`
	DOBs          []unDOB         `xml:"INDIVIDUAL_DATE_OF_BIRTH"`
	POBs          []unPOB         `xml:"INDIVIDUAL_PLACE_OF_BIRTH"`
	Nationalities []unNationality `xml:"NATIONALITY"`
	Addresses     []unAddress     `xml:"INDIVIDUAL_ADDRESS"`
	Documents     []unDocument    `xml:"INDIVIDUAL_DOCUMENT"`
}
