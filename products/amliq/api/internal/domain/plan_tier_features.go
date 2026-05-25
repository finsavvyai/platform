package domain

func (p PlanTier) ScreeningLimit() int {
	switch p {
	case TierStarter, TierStarting:
		return 10000
	case TierBasic:
		return 5000
	case TierStandard:
		return 50000
	case TierProfessional:
		return 100000
	case TierPremium:
		return 500000
	case TierEnterprise:
		return 999999999
	default:
		return 0
	}
}

func (p PlanTier) TenantLimit() int {
	switch p {
	case TierStarter, TierStarting:
		return 1
	case TierBasic, TierStandard:
		return 2
	case TierProfessional:
		return 5
	case TierPremium:
		return 20
	case TierEnterprise:
		return 999999999
	default:
		return 0
	}
}

func (p PlanTier) MaxMatchingLayer() int {
	switch p {
	case TierStarter, TierStarting:
		return 2
	case TierBasic:
		return 2
	case TierStandard:
		return 3
	case TierProfessional:
		return 5
	case TierPremium:
		return 5
	case TierEnterprise:
		return 6
	default:
		return 0
	}
}

func (p PlanTier) Features() []string {
	switch p {
	case TierStarter:
		return []string{
			"10K screenings/month",
			"OFAC + EU + UN lists",
			"L1-L2 matching",
			"1 tenant",
			"Email support",
		}
	case TierProfessional:
		return []string{
			"100K screenings/month",
			"All sanction lists",
			"L1-L5 matching",
			"5 tenants",
			"Priority support",
		}
	case TierEnterprise:
		return []string{
			"Unlimited screenings",
			"Custom lists + all lists",
			"L1-L6 matching + graph analysis",
			"Unlimited tenants",
			"Dedicated CSM",
		}
	default:
		return []string{}
	}
}
