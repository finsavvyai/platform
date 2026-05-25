package domain

import (
	"fmt"
	"time"
)

// RelationshipType categorizes entity relationships.
type RelationshipType string

const (
	RelFamily       RelationshipType = "FAMILY"
	RelBusiness     RelationshipType = "BUSINESS"
	RelAlias        RelationshipType = "ALIAS"
	RelAssociate    RelationshipType = "ASSOCIATE"
	RelShellCompany RelationshipType = "SHELL_COMPANY"
)

// Relationship links two entities with a typed connection.
type Relationship struct {
	ID               string
	SourceEntityID   string
	TargetEntityID   string
	RelationshipType RelationshipType
	Confidence       float64
	SourceList       string
	Metadata         map[string]interface{}
	CreatedAt        time.Time
}

// NewRelationship creates a validated relationship.
func NewRelationship(
	sourceID, targetID string,
	relType RelationshipType,
	confidence float64,
	sourceList string,
) (Relationship, error) {
	if sourceID == "" || targetID == "" {
		return Relationship{}, fmt.Errorf("source and target entity IDs required")
	}
	if confidence < 0 || confidence > 1 {
		return Relationship{}, fmt.Errorf("confidence must be 0-1")
	}
	return Relationship{
		SourceEntityID:   sourceID,
		TargetEntityID:   targetID,
		RelationshipType: relType,
		Confidence:       confidence,
		SourceList:       sourceList,
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now().UTC(),
	}, nil
}
