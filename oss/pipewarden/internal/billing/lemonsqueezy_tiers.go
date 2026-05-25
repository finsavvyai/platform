package billing

// GetTierLimits returns the feature limits for a given tier.
func (c *Client) GetTierLimits(tier Tier) TierLimits {
	switch tier {
	case TierStarter:
		return TierLimits{
			Tier:               TierStarter,
			MaxConnections:     5,
			MaxScansPerDay:     200,
			AIAnalysisEnabled:  true,
			SARIFExport:        true,
			APIAccess:          true,
			Priority:           false,
			AuditRetentionDays: 30,
			MaxTeamMembers:     3,
		}
	case TierTeam:
		return TierLimits{
			Tier:               TierTeam,
			MaxConnections:     10,
			MaxScansPerDay:     500,
			AIAnalysisEnabled:  true,
			SARIFExport:        true,
			APIAccess:          true,
			Priority:           true,
			AuditLog:           true,
			CustomOPAPolicies:  true,
			SIEMIntegration:    true,
			AuditRetentionDays: 180,
			MaxTeamMembers:     10,
		}
	case TierProfessional:
		return TierLimits{
			Tier:               TierProfessional,
			MaxConnections:     25,
			MaxScansPerDay:     1000,
			AIAnalysisEnabled:  true,
			SARIFExport:        true,
			APIAccess:          true,
			Priority:           true,
			ComplianceReports:  true,
			CustomOPAPolicies:  true,
			SIEMIntegration:    true,
			AuditRetentionDays: 90,
			MaxTeamMembers:     15,
		}
	case TierEnterprise:
		return TierLimits{
			Tier:               TierEnterprise,
			MaxConnections:     -1,
			MaxScansPerDay:     -1,
			AIAnalysisEnabled:  true,
			SARIFExport:        true,
			SSOEnabled:         true,
			AuditLog:           true,
			Priority:           true,
			APIAccess:          true,
			ComplianceReports:  true,
			CustomOPAPolicies:  true,
			SIEMIntegration:    true,
			AutoFixPRs:         true,
			AuditRetentionDays: 365,
			MaxTeamMembers:     25,
		}
	case TierEnterpriseP:
		return TierLimits{
			Tier:               TierEnterpriseP,
			MaxConnections:     -1,
			MaxScansPerDay:     -1,
			AIAnalysisEnabled:  true,
			SARIFExport:        true,
			SSOEnabled:         true,
			AuditLog:           true,
			Priority:           true,
			APIAccess:          true,
			ComplianceReports:  true,
			CustomOPAPolicies:  true,
			SIEMIntegration:    true,
			AutoFixPRs:         true,
			OnPremDeployment:   true,
			AuditRetentionDays: -1,
			MaxTeamMembers:     -1,
		}
	default: // TierCommunity
		return TierLimits{
			Tier:               TierCommunity,
			MaxConnections:     1,
			MaxScansPerDay:     10,
			AIAnalysisEnabled:  false,
			SARIFExport:        false,
			AuditRetentionDays: 7,
			MaxTeamMembers:     1,
		}
	}
}
