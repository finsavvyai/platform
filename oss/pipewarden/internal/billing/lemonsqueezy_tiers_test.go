package billing

import "testing"

// TestGetTierLimits_Team covers the TierTeam branch that was previously uncovered.
func TestGetTierLimits_Team(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	limits := client.GetTierLimits(TierTeam)

	if limits.Tier != TierTeam {
		t.Errorf("expected tier %s, got %s", TierTeam, limits.Tier)
	}
	if limits.MaxConnections != 10 {
		t.Errorf("expected MaxConnections=10, got %d", limits.MaxConnections)
	}
	if limits.MaxScansPerDay != 500 {
		t.Errorf("expected MaxScansPerDay=500, got %d", limits.MaxScansPerDay)
	}
	if !limits.AIAnalysisEnabled {
		t.Error("expected AIAnalysisEnabled=true for team tier")
	}
	if !limits.SARIFExport {
		t.Error("expected SARIFExport=true for team tier")
	}
	if !limits.APIAccess {
		t.Error("expected APIAccess=true for team tier")
	}
	if !limits.Priority {
		t.Error("expected Priority=true for team tier")
	}
	if !limits.AuditLog {
		t.Error("expected AuditLog=true for team tier")
	}
	if !limits.CustomOPAPolicies {
		t.Error("expected CustomOPAPolicies=true for team tier")
	}
	if !limits.SIEMIntegration {
		t.Error("expected SIEMIntegration=true for team tier")
	}
	if limits.SSOEnabled {
		t.Error("expected SSOEnabled=false for team tier")
	}
	if limits.OnPremDeployment {
		t.Error("expected OnPremDeployment=false for team tier")
	}
	if limits.ComplianceReports {
		t.Error("expected ComplianceReports=false for team tier")
	}
	if limits.AuditRetentionDays != 180 {
		t.Errorf("expected AuditRetentionDays=180, got %d", limits.AuditRetentionDays)
	}
	if limits.MaxTeamMembers != 10 {
		t.Errorf("expected MaxTeamMembers=10, got %d", limits.MaxTeamMembers)
	}
}

// TestGetTierLimits_Default exercises the default (community) branch via an
// unrecognised tier string so the switch falls through to the default case.
func TestGetTierLimits_UnknownDefaultsToCommunity(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	limits := client.GetTierLimits(Tier("unknown-tier"))

	if limits.Tier != TierCommunity {
		t.Errorf("expected default Tier=%s, got %s", TierCommunity, limits.Tier)
	}
	if limits.MaxConnections != 1 {
		t.Errorf("expected MaxConnections=1, got %d", limits.MaxConnections)
	}
	if limits.MaxScansPerDay != 10 {
		t.Errorf("expected MaxScansPerDay=10, got %d", limits.MaxScansPerDay)
	}
	if limits.AIAnalysisEnabled {
		t.Error("expected AIAnalysisEnabled=false for unknown/community tier")
	}
	if limits.SARIFExport {
		t.Error("expected SARIFExport=false for unknown/community tier")
	}
	if limits.AuditRetentionDays != 7 {
		t.Errorf("expected AuditRetentionDays=7, got %d", limits.AuditRetentionDays)
	}
	if limits.MaxTeamMembers != 1 {
		t.Errorf("expected MaxTeamMembers=1, got %d", limits.MaxTeamMembers)
	}
}

// TestGetTierLimits_AllTiersReturnCorrectTierField ensures every tier constant
// round-trips through GetTierLimits with its own Tier field set correctly.
func TestGetTierLimits_AllTiersReturnCorrectTierField(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	cases := []Tier{
		TierCommunity,
		TierStarter,
		TierTeam,
		TierProfessional,
		TierEnterprise,
		TierEnterpriseP,
	}
	for _, tier := range cases {
		limits := client.GetTierLimits(tier)
		if limits.Tier != tier {
			t.Errorf("tier %s: GetTierLimits returned Tier=%s", tier, limits.Tier)
		}
	}
}
