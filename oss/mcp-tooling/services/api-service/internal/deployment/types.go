package deployment

import (
	"context"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// DeploymentProvider defines the interface for deployment providers
type DeploymentProvider interface {
	// Generate generates deployment configuration files
	Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts DeploymentOptions) (*DeploymentPackage, error)

	// Deploy performs the actual deployment
	Deploy(ctx context.Context, pkg *DeploymentPackage, opts DeploymentOptions) (*DeploymentResult, error)

	// GetName returns the provider name
	GetName() string

	// GetVersion returns the provider version
	GetVersion() string

	// GetFeatures returns supported features
	GetFeatures() []DeploymentFeature

	// ValidateOptions validates deployment options
	ValidateOptions(opts DeploymentOptions) error
}

// DeploymentPackage represents a complete deployment package
type DeploymentPackage struct {
	Platform   string               `json:"platform"`
	Files      []DeploymentFile     `json:"files"`
	CreatedAt  time.Time            `json:"created_at"`
	Metadata   DeploymentMetadata   `json:"metadata"`
	Statistics DeploymentStatistics `json:"statistics"`
}

// DeploymentFile represents a single deployment configuration file
type DeploymentFile struct {
	Path     string   `json:"path"`
	Content  string   `json:"content"`
	FileType FileType `json:"file_type"`
}

// FileType represents the type of deployment file
type FileType string

const (
	FileTypeConfig FileType = "config"
	FileTypeSource FileType = "source"
	FileTypeScript FileType = "script"
	FileTypeDoc    FileType = "documentation"
)

// DeploymentMetadata contains metadata about the deployment
type DeploymentMetadata struct {
	Platform       string                 `json:"platform"`
	Region         string                 `json:"region"`
	Runtime        string                 `json:"runtime"`
	MemorySize     int                    `json:"memory_size"`
	Timeout        int                    `json:"timeout"`
	HasVPC         bool                   `json:"has_vpc"`
	HasMonitoring  bool                   `json:"has_monitoring"`
	HasAutoScaling bool                   `json:"has_auto_scaling"`
	Extensions     map[string]interface{} `json:"extensions,omitempty"`
}

// DeploymentStatistics contains statistics about the deployment package
type DeploymentStatistics struct {
	TotalFiles      int           `json:"total_files"`
	ConfigFiles     int           `json:"config_files"`
	ScriptFiles     int           `json:"script_files"`
	GenerationTime  time.Duration `json:"generation_time"`
	EstimatedCost   float64       `json:"estimated_cost"`
	RequiredSecrets []string      `json:"required_secrets"`
}

// DeploymentOptions contains options for deployment generation
type DeploymentOptions struct {
	// Platform options
	Platform string `json:"platform"` // aws-lambda, gcp-functions, azure-functions, cloudflare, self-hosted, dedicated

	// Dedicated Enterprise options
	DedicatedRegion       string `json:"dedicated_region"`       // e.g. "us-east-1-dedicated"
	DedicatedInstanceType string `json:"dedicated_instance_type"` // e.g. "m5.large"
	DedicatedVPCID        string `json:"dedicated_vpc_id"`
	DedicatedIsolationLvl string `json:"dedicated_isolation_level"` // "pod", "node", "cluster"

	// AWS Lambda options
	AWSRegion         string `json:"aws_region"`
	Runtime           string `json:"runtime"`
	MemorySize        int    `json:"memory_size"`
	Timeout           int    `json:"timeout"`
	Architecture      string `json:"architecture"` // x86_64, arm64
	UseVPC            bool   `json:"use_vpc"`
	EnableAutoScaling bool   `json:"enable_auto_scaling"`

	// GCP Functions options
	GCPProjectID string `json:"gcp_project_id"`
	GCPRegion    string `json:"gcp_region"`

	// Azure Functions options
	AzureRegion         string `json:"azure_region"`
	AzureSubscriptionID string `json:"azure_subscription_id"`
	AzureResourceGroup  string `json:"azure_resource_group"`

	// Infrastructure as Code options
	UseSAM       bool `json:"use_sam"`
	UseCDK       bool `json:"use_cdk"`
	UseTerraform bool `json:"use_terraform"`

	// CI/CD options
	CICDProvider string `json:"cicd_provider"` // github-actions, gitlab-ci, jenkins, circleci

	// Monitoring options
	EnableXRay            bool `json:"enable_xray"`
	EnableCloudWatch      bool `json:"enable_cloudwatch"`
	EnableCustomMetrics   bool `json:"enable_custom_metrics"`
	AlarmSNSTopicARN      string `json:"alarm_sns_topic_arn"`

	// Security options
	UseSecretsManager bool     `json:"use_secrets_manager"`
	KMSKeyARN         string   `json:"kms_key_arn"`
	IAMRoleName       string   `json:"iam_role_name"`
	SecurityGroupIDs  []string `json:"security_group_ids"`
	SubnetIDs         []string `json:"subnet_ids"`

	// General options
	IncludeDocs      bool              `json:"include_docs"`
	IncludeTests     bool              `json:"include_tests"`
	IncludeExamples  bool              `json:"include_examples"`
	Tags             map[string]string `json:"tags"`
	EnvironmentVars  map[string]string `json:"environment_vars"`
}

// DefaultDeploymentOptions returns default deployment options
func DefaultDeploymentOptions() DeploymentOptions {
	return DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-east-1",
		Runtime:      "python3.11",
		MemorySize:   512,
		Timeout:      30,
		Architecture: "x86_64",
		UseSAM:       true,
		UseCDK:       false,
		UseTerraform: false,
		CICDProvider: "github-actions",
		EnableXRay:   true,
		EnableCloudWatch: true,
		IncludeDocs:  true,
		Tags:         make(map[string]string),
		EnvironmentVars: make(map[string]string),
	}
}

// DeploymentResult represents the result of a deployment operation
type DeploymentResult struct {
	Success      bool                   `json:"success"`
	DeploymentID string                 `json:"deployment_id"`
	Endpoint     string                 `json:"endpoint"`
	StartTime    time.Time              `json:"start_time"`
	EndTime      time.Time              `json:"end_time"`
	Duration     time.Duration          `json:"duration"`
	Logs         []string               `json:"logs"`
	Errors       []string               `json:"errors"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// DeploymentFeature represents a deployment feature flag
type DeploymentFeature string

const (
	// Infrastructure features
	DeploymentFeatureSAM              DeploymentFeature = "sam"
	DeploymentFeatureCDK              DeploymentFeature = "cdk"
	DeploymentFeatureTerraform        DeploymentFeature = "terraform"
	DeploymentFeatureCloudFormation   DeploymentFeature = "cloudformation"

	// Platform features
	DeploymentFeatureLambda           DeploymentFeature = "lambda"
	DeploymentFeatureGCPFunctions     DeploymentFeature = "gcp-functions"
	DeploymentFeatureAzureFunctions   DeploymentFeature = "azure-functions"
	DeploymentFeatureCloudflare       DeploymentFeature = "cloudflare"
	DeploymentFeatureSelfHosted       DeploymentFeature = "self-hosted"
	DeploymentFeatureDedicated        DeploymentFeature = "dedicated"

	// CI/CD features
	DeploymentFeatureCICD             DeploymentFeature = "cicd"
	DeploymentFeatureGitHubActions    DeploymentFeature = "github-actions"
	DeploymentFeatureGitLabCI         DeploymentFeature = "gitlab-ci"
	DeploymentFeatureJenkins          DeploymentFeature = "jenkins"
	DeploymentFeatureCircleCI         DeploymentFeature = "circleci"

	// Monitoring features
	DeploymentFeatureMonitoring       DeploymentFeature = "monitoring"
	DeploymentFeatureXRay             DeploymentFeature = "xray"
	DeploymentFeatureCloudWatch       DeploymentFeature = "cloudwatch"
	DeploymentFeatureCustomMetrics    DeploymentFeature = "custom-metrics"
	DeploymentFeatureAlerting         DeploymentFeature = "alerting"
	DeploymentFeatureDashboards       DeploymentFeature = "dashboards"

	// Scaling features
	DeploymentFeatureAutoScaling      DeploymentFeature = "auto-scaling"
	DeploymentFeatureProvisionedConcurrency DeploymentFeature = "provisioned-concurrency"

	// Security features
	DeploymentFeatureVPC              DeploymentFeature = "vpc"
	DeploymentFeatureSecretsManager   DeploymentFeature = "secrets-manager"
	DeploymentFeatureKMS              DeploymentFeature = "kms"
	DeploymentFeatureIAMRoles         DeploymentFeature = "iam-roles"
	DeploymentFeatureSecurityGroups   DeploymentFeature = "security-groups"
	DeploymentFeatureSSO              DeploymentFeature = "sso"
	DeploymentFeaturePrivateSubnets   DeploymentFeature = "private-subnets"
	DeploymentFeatureAuditLogging     DeploymentFeature = "audit-logging"

	// Configuration features
	DeploymentFeatureEnvironmentVariables DeploymentFeature = "environment-variables"
	DeploymentFeatureSecrets          DeploymentFeature = "secrets"
	DeploymentFeatureTags             DeploymentFeature = "tags"

	// Networking features
	DeploymentFeatureAPIGateway       DeploymentFeature = "api-gateway"
	DeploymentFeatureLoadBalancer     DeploymentFeature = "load-balancer"
	DeploymentFeatureCORS             DeploymentFeature = "cors"
	DeploymentFeatureCustomDomain     DeploymentFeature = "custom-domain"
)

// ValidationResult contains validation results
type ValidationResult struct {
	Valid  bool     `json:"valid"`
	Errors []string `json:"errors"`
}

// DeploymentRegistry manages deployment providers
type DeploymentRegistry struct {
	providers map[string]DeploymentProvider
}

// NewDeploymentRegistry creates a new deployment registry
func NewDeploymentRegistry() *DeploymentRegistry {
	return &DeploymentRegistry{
		providers: make(map[string]DeploymentProvider),
	}
}

// Register registers a deployment provider
func (r *DeploymentRegistry) Register(provider DeploymentProvider) {
	r.providers[provider.GetName()] = provider
}

// Get retrieves a deployment provider by name
func (r *DeploymentRegistry) Get(name string) (DeploymentProvider, bool) {
	provider, ok := r.providers[name]
	return provider, ok
}

// List returns all registered providers
func (r *DeploymentRegistry) List() []DeploymentProvider {
	providers := make([]DeploymentProvider, 0, len(r.providers))
	for _, provider := range r.providers {
		providers = append(providers, provider)
	}
	return providers
}

// Global registry instance
var GlobalDeploymentRegistry = NewDeploymentRegistry()
