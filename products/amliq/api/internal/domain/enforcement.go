package domain

import (
	"fmt"
	"time"
)

// EnforcementActionType categorizes regulatory actions.
type EnforcementActionType string

const (
	ActionFine              EnforcementActionType = "fine"
	ActionBan               EnforcementActionType = "ban"
	ActionWarning           EnforcementActionType = "warning"
	ActionLicenseRevocation EnforcementActionType = "license_revocation"
	ActionCeaseDesist       EnforcementActionType = "cease_desist"
)

// EnforcementAction records a regulatory action against an entity.
type EnforcementAction struct {
	ID           string
	EntityName   string
	EntityType   string
	Regulator    string
	ActionType   EnforcementActionType
	Amount       *float64
	Currency     string
	Date         time.Time
	Description  string
	URL          string
	Jurisdiction string
	CreatedAt    time.Time
}

func NewEnforcementAction(
	entityName, regulator string, actionType EnforcementActionType,
	date time.Time, description, url, jurisdiction string,
) (EnforcementAction, error) {
	if entityName == "" || regulator == "" {
		return EnforcementAction{}, fmt.Errorf("entity name and regulator required")
	}
	return EnforcementAction{
		ID:           fmt.Sprintf("enf_%d", time.Now().UnixNano()),
		EntityName:   entityName,
		Regulator:    regulator,
		ActionType:   actionType,
		Date:         date,
		Description:  description,
		URL:          url,
		Jurisdiction: jurisdiction,
		CreatedAt:    time.Now().UTC(),
	}, nil
}
