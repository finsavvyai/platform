package entitlement

// Feature identifiers — keep in sync with api/src/entitlements.ts FeatureKey.
const (
	FeatureAIEdit          = "ai_edit"
	FeatureAIDiagnosis     = "ai_diagnosis"
	FeatureCloudMinutes    = "cloud_minutes"
	FeatureCloudSchedules  = "cloud_schedules"
	FeatureDeployTargets   = "deploy_targets"
	FeatureSSO             = "sso"
	FeatureAuditLogs       = "audit_logs"
	FeaturePrioritySupport = "priority_support"
)

var validFeatures = map[string]struct{}{
	FeatureAIEdit:          {},
	FeatureAIDiagnosis:     {},
	FeatureCloudMinutes:    {},
	FeatureCloudSchedules:  {},
	FeatureDeployTargets:   {},
	FeatureSSO:             {},
	FeatureAuditLogs:       {},
	FeaturePrioritySupport: {},
}
