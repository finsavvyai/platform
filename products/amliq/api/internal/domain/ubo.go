package domain

import (
	"fmt"
	"time"
)

// UBOStatus tracks beneficial ownership verification state.
type UBOStatus string

const (
	UBOPending  UBOStatus = "pending"
	UBOVerified UBOStatus = "verified"
	UBOFlagged  UBOStatus = "flagged"
	UBORejected UBOStatus = "rejected"
)

// BeneficialOwner represents an Ultimate Beneficial Owner.
type BeneficialOwner struct {
	ID               string
	TenantID         TenantID
	OrganizationID   string
	OwnerName        string
	OwnerNationality string
	OwnershipPct     float64
	IsDirectOwner    bool
	IsPEP            bool
	PEPTier          PEPTier
	Status           UBOStatus
	VerifiedAt       *time.Time
	CreatedAt        time.Time
}

func NewBeneficialOwner(
	tenantID TenantID, orgID, name, nationality string,
	pct float64, direct bool,
) (BeneficialOwner, error) {
	if tenantID.IsZero() || orgID == "" || name == "" {
		return BeneficialOwner{}, fmt.Errorf("tenant, org and name required")
	}
	if pct < 0 || pct > 100 {
		return BeneficialOwner{}, fmt.Errorf("ownership pct must be 0-100")
	}
	return BeneficialOwner{
		ID:               fmt.Sprintf("ubo_%d", time.Now().UnixNano()),
		TenantID:         tenantID,
		OrganizationID:   orgID,
		OwnerName:        name,
		OwnerNationality: nationality,
		OwnershipPct:     pct,
		IsDirectOwner:    direct,
		Status:           UBOPending,
		CreatedAt:        time.Now().UTC(),
	}, nil
}

// OwnershipChain represents the full beneficial ownership hierarchy.
type OwnershipChain struct {
	OrganizationID string
	Owners         []BeneficialOwner
	TotalVerified  int
	TotalFlagged   int
}
