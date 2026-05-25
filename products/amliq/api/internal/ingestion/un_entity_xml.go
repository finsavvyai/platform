package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// unEntityXML represents an ENTITY element in the UN XML.
type unEntityXML struct {
	DataID      string       `xml:"DATAID"`
	RefNumber   string       `xml:"REFERENCE_NUMBER"`
	FirstName   string       `xml:"FIRST_NAME"`
	SecondName  string       `xml:"SECOND_NAME"`
	ThirdName   string       `xml:"THIRD_NAME"`
	FourthName  string       `xml:"FOURTH_NAME"`
	NameOrig    string       `xml:"NAME_ORIGINAL_SCRIPT"`
	Designation string       `xml:"DESIGNATION"`
	Title       string       `xml:"TITLE"`
	ListType    string       `xml:"UN_LIST_TYPE"`
	ListedOn    string       `xml:"LISTED_ON"`
	LastUpdated string       `xml:"LAST_DAY_UPDATED"`
	Comments1   string       `xml:"COMMENTS1"`
	SubmittedBy string       `xml:"SUBMITTED_BY"`
	Aliases     []unAlias    `xml:"ENTITY_ALIAS"`
	Addresses   []unAddress  `xml:"ENTITY_ADDRESS"`
	Documents   []unDocument `xml:"ENTITY_DOCUMENT"`
}

func (e *unEntityXML) toEntity() (domain.Entity, bool) {
	names := extractUNNames(
		e.FirstName, e.SecondName, e.ThirdName,
		e.FourthName, e.NameOrig, e.Aliases,
	)
	primary := choosePrimaryLatinName(names)
	if primary == "" {
		return domain.Entity{}, false
	}
	normalized := NormalizeName(primary)
	if normalized == "" {
		return domain.Entity{}, false
	}

	meta := unMeta{
		aliases:        filterAliases(names, primary),
		addresses:      e.Addresses,
		documents:      e.Documents,
		program:        firstNonEmptyStr(e.ListType),
		listedOn:       firstNonEmptyStr(e.ListedOn, e.LastUpdated),
		lastChange:     strings.TrimSpace(e.LastUpdated),
		comments:       strings.TrimSpace(e.Comments1),
		designation:    strings.TrimSpace(e.Designation),
		title:          strings.TrimSpace(e.Title),
		submittedBy:    strings.TrimSpace(e.SubmittedBy),
		originalScript: strings.TrimSpace(e.NameOrig),
	}

	listID := firstNonEmptyStr(e.DataID, e.RefNumber, e.ListType)
	return buildUNEntity(listID, normalized,
		domain.EntityTypeCompany, meta)
}
