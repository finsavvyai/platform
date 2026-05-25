package domain

import "fmt"

// RCAType represents a Relative or Close Associate relationship.
type RCAType string

const (
	RCASpouse       RCAType = "spouse"
	RCAChild        RCAType = "child"
	RCAParent       RCAType = "parent"
	RCASibling      RCAType = "sibling"
	RCAAssociate    RCAType = "business_associate"
	RCAAdvisor      RCAType = "advisor"
	RCARepresentant RCAType = "legal_representative"
)

// RCARelation links a PEP to a relative or close associate.
type RCARelation struct {
	PEPEntityID     string
	RelatedEntityID string
	RelationType    RCAType
	Description     string
}

func NewRCARelation(
	pepID, relatedID string, relType RCAType, desc string,
) (RCARelation, error) {
	if pepID == "" || relatedID == "" {
		return RCARelation{}, fmt.Errorf("both entity IDs required")
	}
	return RCARelation{
		PEPEntityID:     pepID,
		RelatedEntityID: relatedID,
		RelationType:    relType,
		Description:     desc,
	}, nil
}

// PEPProfile enriches an entity with PEP-specific data.
type PEPProfile struct {
	EntityID           string
	Tier               PEPTier
	Position           string
	Country            string
	ActiveFrom         string
	ActiveTo           string
	IsActive           bool
	Relations          []RCARelation
	Classification     PEPClassification
	IsDomestic         bool
	ScreeningCountry   string
}

func NewPEPProfile(
	entityID string,
	tier PEPTier,
	position, country string,
) PEPProfile {
	return PEPProfile{
		EntityID:       entityID,
		Tier:           tier,
		Position:       position,
		Country:        country,
		IsActive:       true,
		Classification: PEPNone,
	}
}
