package nlp

import "strings"

// tenantiqPatterns adds TenantIQ-specific NLP patterns.
var tenantiqPatterns = []pattern{
	{keywords: []string{"scan tenant", "scan all tenant"}, toAction: patternTenantiqScan},
	{keywords: []string{"check compliance", "cis scan", "cis benchmark", "compliance scan"}, toAction: patternTenantiqCIS},
	{keywords: []string{"sync psa", "sync connectwise", "sync datto", "sync kaseya"}, toAction: patternTenantiqSyncPSA},
	{keywords: []string{"backup exchange", "backup mailbox", "backup sharepoint"}, toAction: patternTenantiqBackup},
	{keywords: []string{"tenant health", "health score", "health check tenant"}, toAction: patternTenantiqHealth},
}

func init() {
	knownPatterns = append(knownPatterns, tenantiqPatterns...)
}

func patternTenantiqScan(_ string) *Action {
	return &Action{Type: "tenantiq_scan", Params: map[string]string{}}
}

func patternTenantiqCIS(_ string) *Action {
	return &Action{Type: "tenantiq_cis", Params: map[string]string{}}
}

func patternTenantiqSyncPSA(input string) *Action {
	provider := "connectwise"
	for _, p := range []string{"datto", "kaseya"} {
		if strings.Contains(input, p) {
			provider = p
			break
		}
	}
	return &Action{Type: "tenantiq_sync_psa", Params: map[string]string{"provider": provider}}
}

func patternTenantiqBackup(input string) *Action {
	scope := "exchange"
	if strings.Contains(input, "sharepoint") {
		scope = "sharepoint"
	}
	return &Action{Type: "tenantiq_backup", Params: map[string]string{"scope": scope}}
}

func patternTenantiqHealth(_ string) *Action {
	return &Action{Type: "tenantiq_health", Params: map[string]string{}}
}
