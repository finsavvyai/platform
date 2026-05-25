package billing

// FreeTierLimits defines the limits when no billing provider is configured.
type FreeTierLimits struct {
	ScreeningsPerDay int
	Seats            int
	Lists            []string
}

// DefaultFreeTier returns conservative free-tier defaults.
func DefaultFreeTier() FreeTierLimits {
	return FreeTierLimits{
		ScreeningsPerDay: 100,
		Seats:            1,
		Lists:            []string{"ofac_sdn", "eu_fsf", "un_consolidated"},
	}
}

// IsFreeTier returns true when no billing provider is configured.
func IsFreeTier(svc *BillingService) bool {
	return svc == nil
}
