package deployment

import (
	"context"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewAWSLambdaDeployment(t *testing.T) {
	deploy := NewAWSLambdaDeployment()

	assert.NotNil(t, deploy)
	assert.Equal(t, "aws-lambda", deploy.GetName())
	assert.Equal(t, "1.0.0", deploy.GetVersion())

	features := deploy.GetFeatures()
	assert.Contains(t, features, DeploymentFeatureSAM)
	assert.Contains(t, features, DeploymentFeatureCDK)
	assert.Contains(t, features, DeploymentFeatureTerraform)
	assert.Contains(t, features, DeploymentFeatureCICD)
	assert.Contains(t, features, DeploymentFeatureMonitoring)
}

func TestAWSLambdaDeployment_Generate(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "test-api",
			Title:       "Test API",
			Description: "Test API Description",
			Version:     "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				Path:        "/users",
				Method:      "GET",
				Name:        "getUsers",
				Description: "Retrieves a list of all users",
			},
			{
				Path:        "/users/{id}",
				Method:      "GET",
				Name:        "getUserById",
				Description: "Get user by ID",
				Parameters: []parser.Parameter{
					{
						Name:        "id",
						In:          "path",
						Required:    true,
						Description: "User ID",
						Schema: &parser.TypeReference{
							Type: "string",
						},
					},
				},
			},
		},
		Servers: []parser.ServerConfig{
			{
				URL:         "https://api.example.com",
				Description: "Production server",
			},
		},
	}

	opts := DeploymentOptions{
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
		IncludeDocs:  true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)
	assert.NotNil(t, pkg)
	assert.Equal(t, "aws-lambda", pkg.Platform)
	assert.Greater(t, len(pkg.Files), 0)
	assert.Equal(t, "us-east-1", pkg.Metadata.Region)
	assert.Equal(t, "python3.11", pkg.Metadata.Runtime)
}

func TestAWSLambdaDeployment_GenerateWithAuth(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "secure-api",
			Title:       "Secure API",
			Description: "API with authentication",
			Version:     "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				Path:        "/protected",
				Method:      "GET",
				Name:        "getProtected",
				Description: "Get protected resource",
			},
		},
		Auth: []parser.AuthScheme{
			{
				Type:   "apiKey",
				Name:   "X-API-Key",
				In:     "header",
				Scheme: "",
			},
		},
		Servers: []parser.ServerConfig{
			{
				URL: "https://api.example.com",
			},
		},
	}

	opts := DefaultDeploymentOptions()

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)
	assert.NotNil(t, pkg)

	// Check that auth parameters are included
	samTemplateFound := false
	for _, file := range pkg.Files {
		if file.Path == "template.yaml" {
			samTemplateFound = true
			assert.Contains(t, file.Content, "ApiKey")
			break
		}
	}
	assert.True(t, samTemplateFound)
}

func TestAWSLambdaDeployment_GenerateSAMTemplate(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "sam-test-api",
			Title:       "SAM Test API",
			Description: "Testing SAM template generation",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				Path:   "/test",
				Method: "GET",
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-west-2",
		Runtime:      "python3.11",
		MemorySize:   1024,
		Timeout:      60,
		Architecture: "arm64",
		UseSAM:       true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find template.yaml
	var templateContent string
	for _, file := range pkg.Files {
		if file.Path == "template.yaml" {
			templateContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, templateContent)
	assert.Contains(t, templateContent, "AWSTemplateFormatVersion")
	assert.Contains(t, templateContent, "AWS::Serverless-2016-10-31")
	assert.Contains(t, templateContent, "AWS::Serverless::Function")
	assert.Contains(t, templateContent, "python3.11")
	assert.Contains(t, templateContent, "1024")
	assert.Contains(t, templateContent, "60")
	assert.Contains(t, templateContent, "arm64")
}

func TestAWSLambdaDeployment_GenerateSAMConfig(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "config-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:  "aws-lambda",
		AWSRegion: "eu-west-1",
		Runtime:   "python3.11",
		UseSAM:    true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find samconfig.toml
	var configContent string
	for _, file := range pkg.Files {
		if file.Path == "samconfig.toml" {
			configContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, configContent)
	assert.Contains(t, configContent, "stack_name")
	assert.Contains(t, configContent, "eu-west-1")
	assert.Contains(t, configContent, "CAPABILITY_IAM")
}

func TestAWSLambdaDeployment_GenerateCDK(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "cdk-test-api",
			Title:       "CDK Test API",
			Description: "Testing CDK generation",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-east-1",
		Runtime:      "python3.11",
		MemorySize:   512,
		Timeout:      30,
		Architecture: "x86_64",
		UseCDK:       true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for CDK files
	expectedFiles := []string{
		"cdk/app.ts",
		"cdk/lib/mcp-stack.ts",
		"cdk/package.json",
		"cdk/tsconfig.json",
		"cdk/cdk.json",
	}

	fileMap := make(map[string]bool)
	for _, file := range pkg.Files {
		fileMap[file.Path] = true
	}

	for _, expectedFile := range expectedFiles {
		assert.True(t, fileMap[expectedFile], "Expected file %s not found", expectedFile)
	}
}

func TestAWSLambdaDeployment_GenerateCDKStack(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "stack-test",
			Title:       "Stack Test",
			Description: "Testing CDK stack",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:  "aws-lambda",
		AWSRegion: "us-east-1",
		Runtime:   "python3.11",
		UseCDK:    true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find stack file
	var stackContent string
	for _, file := range pkg.Files {
		if file.Path == "cdk/lib/mcp-stack.ts" {
			stackContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, stackContent)
	assert.Contains(t, stackContent, "import * as cdk")
	assert.Contains(t, stackContent, "import * as lambda")
	assert.Contains(t, stackContent, "import * as apigateway")
	assert.Contains(t, stackContent, "export class")
	assert.Contains(t, stackContent, "Stack")
	assert.Contains(t, stackContent, "lambda.Function")
	assert.Contains(t, stackContent, "apigateway.RestApi")
}

func TestAWSLambdaDeployment_GenerateTerraform(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "terraform-test",
			Title:       "Terraform Test",
			Description: "Testing Terraform generation",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-east-1",
		Runtime:      "python3.11",
		UseTerraform: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for Terraform files
	expectedFiles := []string{
		"terraform/main.tf",
		"terraform/variables.tf",
		"terraform/outputs.tf",
		"terraform/backend.tf",
	}

	fileMap := make(map[string]bool)
	for _, file := range pkg.Files {
		fileMap[file.Path] = true
	}

	for _, expectedFile := range expectedFiles {
		assert.True(t, fileMap[expectedFile], "Expected file %s not found", expectedFile)
	}
}

func TestAWSLambdaDeployment_GenerateTerraformMain(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "tf-main-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-west-2",
		Runtime:      "python3.11",
		UseTerraform: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find main.tf
	var mainContent string
	for _, file := range pkg.Files {
		if file.Path == "terraform/main.tf" {
			mainContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, mainContent)
	assert.Contains(t, mainContent, "terraform")
	assert.Contains(t, mainContent, "required_providers")
	assert.Contains(t, mainContent, "aws")
	assert.Contains(t, mainContent, "aws_lambda_function")
	assert.Contains(t, mainContent, "aws_api_gateway_rest_api")
	assert.Contains(t, mainContent, "aws_iam_role")
}

func TestAWSLambdaDeployment_GenerateCICD_GitHub(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "cicd-github-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-east-1",
		Runtime:      "python3.11",
		CICDProvider: "github-actions",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find GitHub Actions workflow
	var workflowContent string
	for _, file := range pkg.Files {
		if file.Path == ".github/workflows/deploy.yml" {
			workflowContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, workflowContent)
	assert.Contains(t, workflowContent, "name: Deploy")
	assert.Contains(t, workflowContent, "on:")
	assert.Contains(t, workflowContent, "jobs:")
	assert.Contains(t, workflowContent, "runs-on: ubuntu-latest")
	assert.Contains(t, workflowContent, "sam build")
	assert.Contains(t, workflowContent, "sam deploy")
}

func TestAWSLambdaDeployment_GenerateCICD_GitLab(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "cicd-gitlab-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-east-1",
		Runtime:      "python3.11",
		CICDProvider: "gitlab-ci",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find GitLab CI pipeline
	var pipelineContent string
	for _, file := range pkg.Files {
		if file.Path == ".gitlab-ci.yml" {
			pipelineContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, pipelineContent)
	assert.Contains(t, pipelineContent, "stages:")
	assert.Contains(t, pipelineContent, "- test")
	assert.Contains(t, pipelineContent, "- deploy")
	assert.Contains(t, pipelineContent, "sam build")
	assert.Contains(t, pipelineContent, "sam deploy")
}

func TestAWSLambdaDeployment_GenerateDeploymentScripts(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "scripts-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:  "aws-lambda",
		AWSRegion: "us-east-1",
		Runtime:   "python3.11",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for deployment scripts
	expectedScripts := []string{
		"scripts/deploy.sh",
		"scripts/test.sh",
		"scripts/cleanup.sh",
	}

	fileMap := make(map[string]bool)
	for _, file := range pkg.Files {
		fileMap[file.Path] = true
	}

	for _, expectedScript := range expectedScripts {
		assert.True(t, fileMap[expectedScript], "Expected script %s not found", expectedScript)
	}

	// Check deploy script content
	for _, file := range pkg.Files {
		if file.Path == "scripts/deploy.sh" {
			assert.Contains(t, file.Content, "#!/bin/bash")
			assert.Contains(t, file.Content, "sam build")
			assert.Contains(t, file.Content, "sam deploy")
			break
		}
	}
}

func TestAWSLambdaDeployment_GenerateMonitoringConfig(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "monitoring-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:        "aws-lambda",
		AWSRegion:       "us-east-1",
		Runtime:         "python3.11",
		EnableXRay:      true,
		EnableCloudWatch: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for monitoring files
	expectedFiles := []string{
		"monitoring/xray-config.json",
		"monitoring/cloudwatch-insights-queries.json",
	}

	fileMap := make(map[string]bool)
	for _, file := range pkg.Files {
		fileMap[file.Path] = true
	}

	for _, expectedFile := range expectedFiles {
		assert.True(t, fileMap[expectedFile], "Expected file %s not found", expectedFile)
	}
}

func TestAWSLambdaDeployment_VPCConfiguration(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "vpc-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-east-1",
		Runtime:      "python3.11",
		UseVPC:       true,
		SubnetIDs:    []string{"subnet-123", "subnet-456"},
		SecurityGroupIDs: []string{"sg-123"},
		UseSAM:       true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find template and check for VPC config
	var templateContent string
	for _, file := range pkg.Files {
		if file.Path == "template.yaml" {
			templateContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, templateContent)
	assert.Contains(t, templateContent, "VpcConfig")
	assert.True(t, pkg.Metadata.HasVPC)
}

func TestAWSLambdaDeployment_AutoScaling(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "autoscaling-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:          "aws-lambda",
		AWSRegion:         "us-east-1",
		Runtime:           "python3.11",
		EnableAutoScaling: true,
		UseSAM:            true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find template and check for auto scaling
	var templateContent string
	for _, file := range pkg.Files {
		if file.Path == "template.yaml" {
			templateContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, templateContent)
	assert.Contains(t, templateContent, "AutoScaling")
	assert.True(t, pkg.Metadata.HasAutoScaling)
}

func TestAWSLambdaDeployment_Statistics(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "stats-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Auth: []parser.AuthScheme{
			{Type: "apiKey", Name: "X-API-Key", In: "header"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DefaultDeploymentOptions()

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check statistics
	assert.Greater(t, pkg.Statistics.TotalFiles, 0)
	assert.Greater(t, pkg.Statistics.ConfigFiles, 0)
	assert.Greater(t, pkg.Statistics.ScriptFiles, 0)
	assert.Greater(t, pkg.Statistics.GenerationTime.Nanoseconds(), int64(0))
	assert.Greater(t, pkg.Statistics.EstimatedCost, 0.0)
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "API_KEY")
}

func TestAWSLambdaDeployment_SanitizeResourceName(t *testing.T) {
	deploy := NewAWSLambdaDeployment()

	tests := []struct {
		input    string
		expected string
	}{
		{"My API", "my-api"},
		{"Test_API", "test-api"},
		{"API-Service", "api-service"},
		{"Service@Name", "servicename"},
		{"123-Service", "123-service"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := deploy.sanitizeResourceName(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestAWSLambdaDeployment_MultipleIaCTools(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "multi-iac-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-east-1",
		Runtime:      "python3.11",
		UseSAM:       true,
		UseCDK:       true,
		UseTerraform: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Should have files for all IaC tools
	fileMap := make(map[string]bool)
	for _, file := range pkg.Files {
		fileMap[file.Path] = true
	}

	// SAM files
	assert.True(t, fileMap["template.yaml"])
	assert.True(t, fileMap["samconfig.toml"])

	// CDK files
	assert.True(t, fileMap["cdk/app.ts"])
	assert.True(t, fileMap["cdk/lib/mcp-stack.ts"])

	// Terraform files
	assert.True(t, fileMap["terraform/main.tf"])
	assert.True(t, fileMap["terraform/variables.tf"])
}

func TestDefaultDeploymentOptions(t *testing.T) {
	opts := DefaultDeploymentOptions()

	assert.Equal(t, "aws-lambda", opts.Platform)
	assert.Equal(t, "us-east-1", opts.AWSRegion)
	assert.Equal(t, "python3.11", opts.Runtime)
	assert.Equal(t, 512, opts.MemorySize)
	assert.Equal(t, 30, opts.Timeout)
	assert.Equal(t, "x86_64", opts.Architecture)
	assert.True(t, opts.UseSAM)
	assert.False(t, opts.UseCDK)
	assert.False(t, opts.UseTerraform)
	assert.Equal(t, "github-actions", opts.CICDProvider)
	assert.True(t, opts.EnableXRay)
	assert.True(t, opts.EnableCloudWatch)
	assert.True(t, opts.IncludeDocs)
	assert.NotNil(t, opts.Tags)
	assert.NotNil(t, opts.EnvironmentVars)
}

func TestAWSLambdaDeployment_OAuth2Auth(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "oauth-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Auth: []parser.AuthScheme{
			{
				Type:   "oauth2",
				Scheme: "",
				Flows: &parser.OAuthFlows{
					ClientCredentials: &parser.OAuthFlow{
						TokenURL: "https://auth.example.com/token",
						Scopes: map[string]string{
							"read":  "Read access",
							"write": "Write access",
						},
					},
				},
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DefaultDeploymentOptions()

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find template and check for OAuth2 parameters
	var templateContent string
	for _, file := range pkg.Files {
		if file.Path == "template.yaml" {
			templateContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, templateContent)
	assert.Contains(t, templateContent, "ClientId")
	assert.Contains(t, templateContent, "ClientSecret")

	// Check required secrets
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "CLIENT_ID")
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "CLIENT_SECRET")
}

func TestAWSLambdaDeployment_BearerAuth(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "bearer-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Auth: []parser.AuthScheme{
			{
				Type:   "http",
				Scheme: "bearer",
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DefaultDeploymentOptions()

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check required secrets
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "BEARER_TOKEN")
}

func TestAWSLambdaDeployment_FileTypes(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "filetype-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "aws-lambda",
		AWSRegion:    "us-east-1",
		Runtime:      "python3.11",
		UseSAM:       true,
		CICDProvider: "github-actions",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check file types
	configFiles := 0
	scriptFiles := 0

	for _, file := range pkg.Files {
		switch file.FileType {
		case FileTypeConfig:
			configFiles++
		case FileTypeScript:
			scriptFiles++
		}
	}

	assert.Greater(t, configFiles, 0, "Should have config files")
	assert.Greater(t, scriptFiles, 0, "Should have script files")

	// Statistics should match
	assert.Equal(t, configFiles, pkg.Statistics.ConfigFiles)
	assert.Equal(t, scriptFiles, pkg.Statistics.ScriptFiles)
}

func TestAWSLambdaDeployment_EndpointMetadata(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "endpoint-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/users", Method: "GET"},
			{Path: "/users", Method: "POST"},
			{Path: "/users/{id}", Method: "GET"},
			{Path: "/users/{id}", Method: "PUT"},
			{Path: "/users/{id}", Method: "DELETE"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DefaultDeploymentOptions()

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check metadata
	endpointsCount := pkg.Metadata.Extensions["endpoints_count"]
	assert.Equal(t, 5, endpointsCount)
}

func TestAWSLambdaDeployment_EmptyEndpoints(t *testing.T) {
	deploy := NewAWSLambdaDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "empty-test",
		},
		Endpoints: []parser.UnifiedEndpoint{},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DefaultDeploymentOptions()

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)
	assert.NotNil(t, pkg)

	// Should still generate deployment files
	assert.Greater(t, len(pkg.Files), 0)

	// Endpoints count should be 0
	endpointsCount := pkg.Metadata.Extensions["endpoints_count"]
	assert.Equal(t, 0, endpointsCount)
}
