package deployment

import (
	"context"
	"fmt"
	"strings"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// BaseDeployment provides common functionality for deployment providers
type BaseDeployment struct {
	name     string
	version  string
	features []DeploymentFeature
}

// NewBaseDeployment creates a new base deployment provider
func NewBaseDeployment(name, version string, features []DeploymentFeature) *BaseDeployment {
	return &BaseDeployment{
		name:     name,
		version:  version,
		features: features,
	}
}

// GetName returns the provider name
func (b *BaseDeployment) GetName() string {
	return b.name
}

// GetVersion returns the provider version
func (b *BaseDeployment) GetVersion() string {
	return b.version
}

// GetFeatures returns supported features
func (b *BaseDeployment) GetFeatures() []DeploymentFeature {
	return b.features
}

// ValidateOptions validates deployment options
func (b *BaseDeployment) ValidateOptions(opts DeploymentOptions) error {
	errors := []string{}

	// Validate platform
	if opts.Platform == "" {
		errors = append(errors, "platform is required")
	}

	// Validate AWS-specific options
	if opts.Platform == "aws-lambda" {
		if opts.AWSRegion == "" {
			errors = append(errors, "aws_region is required for AWS Lambda")
		}
		if opts.Runtime == "" {
			errors = append(errors, "runtime is required for AWS Lambda")
		}
		if opts.MemorySize < 128 || opts.MemorySize > 10240 {
			errors = append(errors, "memory_size must be between 128 and 10240 MB")
		}
		if opts.Timeout < 1 || opts.Timeout > 900 {
			errors = append(errors, "timeout must be between 1 and 900 seconds")
		}
		if opts.Architecture != "x86_64" && opts.Architecture != "arm64" {
			errors = append(errors, "architecture must be x86_64 or arm64")
		}
	}

	// Validate VPC options
	if opts.UseVPC {
		if len(opts.SubnetIDs) == 0 {
			errors = append(errors, "subnet_ids are required when use_vpc is true")
		}
		if len(opts.SecurityGroupIDs) == 0 {
			errors = append(errors, "security_group_ids are required when use_vpc is true")
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("validation failed: %s", strings.Join(errors, ", "))
	}

	return nil
}

// Deploy is a placeholder implementation
func (b *BaseDeployment) Deploy(ctx context.Context, pkg *DeploymentPackage, opts DeploymentOptions) (*DeploymentResult, error) {
	return nil, fmt.Errorf("deploy not implemented for %s", b.name)
}

// HasFeature checks if a feature is supported
func (b *BaseDeployment) HasFeature(feature DeploymentFeature) bool {
	for _, f := range b.features {
		if f == feature {
			return true
		}
	}
	return false
}

// sanitizeResourceName sanitizes a resource name for cloud platforms
func (b *BaseDeployment) sanitizeResourceName(name string) string {
	// Remove invalid characters and convert to appropriate format
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "_", "-")
	name = strings.ToLower(name)

	// Remove any character that isn't alphanumeric or hyphen
	result := ""
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result += string(r)
		}
	}

	return result
}

// toClassName converts a string to ClassName format
func (b *BaseDeployment) toClassName(s string) string {
	parts := strings.Split(s, "-")
	result := ""
	for _, part := range parts {
		if len(part) > 0 {
			result += strings.ToUpper(part[0:1]) + part[1:]
		}
	}
	return result
}

// toCamelCase converts a string to camelCase format
func (b *BaseDeployment) toCamelCase(s string) string {
	parts := strings.Split(s, "-")
	if len(parts) == 0 {
		return s
	}

	result := parts[0]
	for i := 1; i < len(parts); i++ {
		if len(parts[i]) > 0 {
			result += strings.ToUpper(parts[i][0:1]) + parts[i][1:]
		}
	}
	return result
}

// toSnakeCase converts a string to snake_case format
func (b *BaseDeployment) toSnakeCase(s string) string {
	result := ""
	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result += "_"
		}
		result += strings.ToLower(string(r))
	}
	return result
}

// toKebabCase converts a string to kebab-case format
func (b *BaseDeployment) toKebabCase(s string) string {
	result := ""
	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result += "-"
		}
		result += strings.ToLower(string(r))
	}
	return result
}

// getEndpointCount returns the number of endpoints in the IR
func (b *BaseDeployment) getEndpointCount(ir *parser.IntermediateRepresentation) int {
	return len(ir.Endpoints)
}

// hasAuthentication checks if the IR has authentication
func (b *BaseDeployment) hasAuthentication(ir *parser.IntermediateRepresentation) bool {
	return len(ir.Auth) > 0
}

// getAuthType returns the primary authentication type
func (b *BaseDeployment) getAuthType(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) > 0 {
		return ir.Auth[0].Type
	}
	return "none"
}

// countFilesByType counts files by type
func (b *BaseDeployment) countFilesByType(files []DeploymentFile, fileType FileType) int {
	count := 0
	for _, f := range files {
		if f.FileType == fileType {
			count++
		}
	}
	return count
}

// escapeString escapes special characters in strings
func (b *BaseDeployment) escapeString(s string) string {
	s = strings.ReplaceAll(s, "'", "\\'")
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	return s
}

// quoteString wraps a string in quotes
func (b *BaseDeployment) quoteString(s string) string {
	return fmt.Sprintf("\"%s\"", b.escapeString(s))
}

// indent indents text by the specified number of spaces
func (b *BaseDeployment) indent(text string, spaces int) string {
	prefix := strings.Repeat(" ", spaces)
	lines := strings.Split(text, "\n")
	for i, line := range lines {
		if line != "" {
			lines[i] = prefix + line
		}
	}
	return strings.Join(lines, "\n")
}

// joinStrings joins strings with a separator
func (b *BaseDeployment) joinStrings(items []string, separator string) string {
	return strings.Join(items, separator)
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
