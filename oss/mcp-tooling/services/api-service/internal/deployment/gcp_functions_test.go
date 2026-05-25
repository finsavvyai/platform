package deployment

import (
	"context"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewGCPFunctionsDeployment(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()

	assert.NotNil(t, deploy)
	assert.Equal(t, "gcp-functions", deploy.GetName())
	assert.Equal(t, "1.0.0", deploy.GetVersion())

	features := deploy.GetFeatures()
	assert.Contains(t, features, DeploymentFeatureGCPFunctions)
	assert.Contains(t, features, DeploymentFeatureTerraform)
	assert.Contains(t, features, DeploymentFeatureCICD)
	assert.Contains(t, features, DeploymentFeatureMonitoring)
}

func TestGCPFunctionsDeployment_Generate(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "test-api",
			Title:       "Test API",
			Description: "Test API Description",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				Path:   "/users",
				Method: "GET",
				Name:   "getUsers",
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
		MemorySize:   256,
		Timeout:      60,
		UseTerraform: true,
		CICDProvider: "github-actions",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)
	assert.NotNil(t, pkg)
	assert.Equal(t, "gcp-functions", pkg.Platform)
	assert.Greater(t, len(pkg.Files), 0)
	assert.Equal(t, "us-central1", pkg.Metadata.Region)
	assert.Equal(t, "nodejs20", pkg.Metadata.Runtime)
}

func TestGCPFunctionsDeployment_GenerateTerraform(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:  "terraform-test",
			Title: "Terraform Test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
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

func TestGCPFunctionsDeployment_GenerateTerraformMain(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
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
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "europe-west1",
		Runtime:      "python311",
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
	assert.Contains(t, mainContent, "google")
	assert.Contains(t, mainContent, "google_cloudfunctions2_function")
	assert.Contains(t, mainContent, "google_storage_bucket")
	assert.Contains(t, mainContent, "google_service_account")
}

func TestGCPFunctionsDeployment_GenerateCloudBuild(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "cloudbuild-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find cloudbuild.yaml
	var buildContent string
	for _, file := range pkg.Files {
		if file.Path == "cloudbuild.yaml" {
			buildContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, buildContent)
	assert.Contains(t, buildContent, "steps:")
	assert.Contains(t, buildContent, "gcloud")
	assert.Contains(t, buildContent, "functions")
	assert.Contains(t, buildContent, "deploy")
	assert.Contains(t, buildContent, "--gen2")
	assert.Contains(t, buildContent, "nodejs20")
}

func TestGCPFunctionsDeployment_GenerateDeploymentScripts(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
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
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
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
}

func TestGCPFunctionsDeployment_GenerateCICD(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "cicd-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
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
	assert.Contains(t, workflowContent, "name: Deploy to GCP Functions")
	assert.Contains(t, workflowContent, "google-github-actions/auth")
	assert.Contains(t, workflowContent, "gcloud functions deploy")
}

func TestGCPFunctionsDeployment_GenerateMonitoring(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
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
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find monitoring config
	var monitoringContent string
	for _, file := range pkg.Files {
		if file.Path == "monitoring/alerts.json" {
			monitoringContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, monitoringContent)
	assert.Contains(t, monitoringContent, "alertPolicies")
	assert.Contains(t, monitoringContent, "Error rate")
}

func TestGCPFunctionsDeployment_WithAuth(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "auth-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/protected", Method: "GET"},
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
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
		UseTerraform: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for Secret Manager resources in Terraform
	var mainContent string
	for _, file := range pkg.Files {
		if file.Path == "terraform/main.tf" {
			mainContent = file.Content
			break
		}
	}

	assert.Contains(t, mainContent, "google_secret_manager_secret")
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "API_KEY")
}

func TestGCPFunctionsDeployment_Statistics(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "stats-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Auth: []parser.AuthScheme{
			{Type: "apiKey"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
		UseTerraform: true,
	}

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

func TestGCPFunctionsDeployment_EstimateCost(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()

	ir := &parser.IntermediateRepresentation{
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
	}

	opts := DeploymentOptions{
		MemorySize: 256,
		Timeout:    60,
	}

	cost := deploy.estimateMonthlyCost(ir, opts)

	assert.Greater(t, cost, 0.0)
	assert.Less(t, cost, 100.0) // Sanity check
}

func TestGCPFunctionsDeployment_VPCConfig(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
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
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
		UseVPC:       true,
		UseTerraform: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find main.tf and check for VPC config
	var mainContent string
	for _, file := range pkg.Files {
		if file.Path == "terraform/main.tf" {
			mainContent = file.Content
			break
		}
	}

	assert.Contains(t, mainContent, "vpc_connector")
	assert.True(t, pkg.Metadata.HasVPC)
}

func TestGCPFunctionsDeployment_FileTypes(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
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
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
		UseTerraform: true,
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

func TestGCPFunctionsDeployment_OAuth2Auth(t *testing.T) {
	deploy := NewGCPFunctionsDeployment()
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
				Type: "oauth2",
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "gcp-functions",
		GCPProjectID: "test-project",
		GCPRegion:    "us-central1",
		Runtime:      "nodejs20",
		UseTerraform: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check required secrets
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "CLIENT_ID")
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "CLIENT_SECRET")
}
