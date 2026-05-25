package production

// NetworkingConfig holds networking configuration
type NetworkingConfig struct {
	VPCID string `json:"vpc_id"`
}

// BackupConfig holds backup configuration
type BackupConfig struct {
	Enabled  bool   `json:"enabled"`
	Schedule string `json:"schedule"`
}

// ScalingConfig holds scaling configuration
type ScalingConfig struct {
	MinReplicas int `json:"min_replicas"`
	MaxReplicas int `json:"max_replicas"`
}

// ComplianceConfig holds compliance configuration
type ComplianceConfig struct {
	Enabled   bool     `json:"enabled"`
	Standards []string `json:"standards"`
}

// CertManagerConfig holds cert manager configuration
type CertManagerConfig struct {
	Enabled bool   `json:"enabled"`
	Email   string `json:"email"`
}

// TestingConfig holds testing configuration
type TestingConfig struct {
	Enabled bool `json:"enabled"`
}

// TracingConfig holds tracing configuration
type TracingConfig struct {
	Enabled  bool   `json:"enabled"`
	Provider string `json:"provider"`
}

// AccessLoggingConfig holds access logging configuration
type AccessLoggingConfig struct {
	Enabled bool `json:"enabled"`
}

// EncryptionConfig holds encryption configuration
type EncryptionConfig struct {
	Enabled       bool                      `json:"enabled"`
	AtRest        AtRestEncryptionConfig    `json:"at_rest"`
	InTransit     InTransitEncryptionConfig `json:"in_transit"`
	KeyManagement KeyManagementConfig       `json:"key_management"`
}

// AtRestEncryptionConfig and KeyManagementConfig are defined in data_encryption_config.go

// CertificatesConfig holds certificates configuration
type CertificatesConfig struct {
	Enabled     bool   `json:"enabled"`
	Provider    string `json:"provider"` // "acm", "cert-manager", "manual"
	AutoRenewal bool   `json:"auto_renewal"`
}

// SecurityMonitoringConfig holds security monitoring configuration
type SecurityMonitoringConfig struct {
	Enabled bool `json:"enabled"`
	Logs    bool `json:"logs"`
	Metrics bool `json:"metrics"`
	Alerts  bool `json:"alerts"`
}

// ThreatDetectionConfig holds threat detection configuration
type ThreatDetectionConfig struct {
	Enabled   bool `json:"enabled"`
	GuardDuty bool `json:"guard_duty"`
	Inspector bool `json:"inspector"`
}

// IncidentResponseConfig holds incident response configuration
type IncidentResponseConfig struct {
	Enabled   bool     `json:"enabled"`
	Playbooks []string `json:"playbooks"`
}

// DataProtectionConfig holds data protection configuration
type DataProtectionConfig struct {
	Enabled bool `json:"enabled"`
	DLP     bool `json:"dlp"`
}

// SecurityBackupConfig holds security backup configuration
type SecurityBackupConfig struct {
	Enabled   bool `json:"enabled"`
	Encrypted bool `json:"encrypted"`
}

// PatchingConfig holds patching configuration
type PatchingConfig struct {
	Enabled  bool   `json:"enabled"`
	Schedule string `json:"schedule"`
}

// VulnerabilityConfig holds vulnerability configuration
type VulnerabilityConfig struct {
	Enabled  bool `json:"enabled"`
	Scanning bool `json:"scanning"`
}

// RolesConfig holds roles configuration
type RolesConfig struct {
	Enabled bool `json:"enabled"`
}

// PoliciesConfig holds policies configuration
type PoliciesConfig struct {
	Enabled bool `json:"enabled"`
}

// UsersConfig holds users configuration
type UsersConfig struct {
	Enabled bool `json:"enabled"`
}

// GroupsConfig holds groups configuration
type GroupsConfig struct {
	Enabled bool `json:"enabled"`
}

// MFAConfig holds MFA configuration
type MFAConfig struct {
	Enabled bool `json:"enabled"`
	Enforce bool `json:"enforce"`
}

// AccessAnalyzerConfig holds access analyzer configuration
type AccessAnalyzerConfig struct {
	Enabled bool `json:"enabled"`
}

// CredentialsReportConfig holds credentials report configuration
type CredentialsReportConfig struct {
	Enabled bool `json:"enabled"`
}

// UserPasswordPolicy holds user password policy
type UserPasswordPolicy struct {
	MinimumLength int `json:"minimum_length"`
}

// UserPolicy holds user policy
type UserPolicy struct {
	Name   string `json:"name"`
	Policy string `json:"policy"`
}

// GroupPolicy holds group policy
type GroupPolicy struct {
	Name   string `json:"name"`
	Policy string `json:"policy"`
}

// RolePolicy holds role policy
type RolePolicy struct {
	Name   string `json:"name"`
	Policy string `json:"policy"`
}

// InlinePoliciesConfig holds inline policies configuration
type InlinePoliciesConfig struct {
	Enabled bool `json:"enabled"`
}

// ManagedPoliciesConfig holds managed policies configuration
type ManagedPoliciesConfig struct {
	Enabled bool `json:"enabled"`
}

// AWSServiceAccounts holds AWS service accounts matches
type AWSServiceAccounts struct {
	Accounts []string `json:"accounts"`
}

// GCPServiceAccounts holds GCP service accounts matches
type GCPServiceAccounts struct {
	Accounts []string `json:"accounts"`
}

// AzureServiceAccounts holds Azure service accounts matches
type AzureServiceAccounts struct {
	Accounts []string `json:"accounts"`
}

// ServiceAccountRotationPolicy holds rotation policy matches
type ServiceAccountRotationPolicy struct {
	Days int `json:"days"`
}

// ServiceAccountSecretsConfig holds secrets config matches
type ServiceAccountSecretsConfig struct {
	Enabled bool `json:"enabled"`
}

// AdmissionController holds admission controller config
type AdmissionController struct {
	Enabled bool `json:"enabled"`
}

// SecurityGroupsConfig holds security groups config
type SecurityGroupsConfig struct {
	Enabled bool `json:"enabled"`
}

// NetworkACLsConfig holds network acls config
type NetworkACLsConfig struct {
	Enabled bool `json:"enabled"`
}

// FirewallRulesConfig holds firewall rules config
type FirewallRulesConfig struct {
	Enabled bool `json:"enabled"`
}

// VPNGatewayConfig holds vpn gateway config
type VPNGatewayConfig struct {
	Enabled bool `json:"enabled"`
}

// DirectConnectConfig holds direct connect config
type DirectConnectConfig struct {
	Enabled bool `json:"enabled"`
}

// PrivateLinkConfig holds private link config
type PrivateLinkConfig struct {
	Enabled bool `json:"enabled"`
}

// RateLimitingConfig holds rate limiting config
type RateLimitingConfig struct {
	Enabled bool `json:"enabled"`
}

// AuthConfig holds auth config
type AuthConfig struct {
	Enabled bool `json:"enabled"`
}

// AuthzConfig holds authz config
type AuthzConfig struct {
	Enabled bool `json:"enabled"`
}

// DNSSECConfig holds dnssec config
type DNSSECConfig struct {
	Enabled bool `json:"enabled"`
}

// HeaderSecurityConfig holds header security config
type HeaderSecurityConfig struct {
	Enabled bool `json:"enabled"`
}

// OutboundRule holds outbound rule
type OutboundRule struct {
	Destination string `json:"destination"`
	Port        int    `json:"port"`
	Protocol    string `json:"protocol"`
}
