package domain

import (
	"fmt"
	"strings"
)

type PlanTier string

const (
	TierStarter      PlanTier = "starter"
	TierBasic        PlanTier = "basic"
	TierStandard     PlanTier = "standard"
	TierProfessional PlanTier = "professional"
	TierPremium      PlanTier = "premium"
	TierEnterprise   PlanTier = "enterprise"
	// Alias for API/SDK tier
	TierStarting PlanTier = "starting"
)

func ParsePlanTier(s string) (PlanTier, error) {
	tier := PlanTier(strings.ToLower(s))
	if tier.IsValid() {
		return tier, nil
	}
	return "", fmt.Errorf("invalid plan tier: %s", s)
}

func (p PlanTier) String() string {
	return string(p)
}

func (p PlanTier) DisplayName() string {
	switch p {
	case TierStarter, TierStarting:
		return "Starter"
	case TierBasic:
		return "Basic"
	case TierStandard:
		return "Standard"
	case TierProfessional:
		return "Professional"
	case TierPremium:
		return "Premium"
	case TierEnterprise:
		return "Enterprise"
	default:
		return string(p)
	}
}

func (p PlanTier) IsValid() bool {
	switch p {
	case TierStarter, TierBasic, TierStandard, TierProfessional, TierPremium, TierEnterprise, TierStarting:
		return true
	}
	return false
}
