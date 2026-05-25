package deployment

import (
	"context"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewAzureFunctionsDeployment(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()

	assert.NotNil(t, deploy)
	assert.Equal(t, "azure-functions", deploy.GetName())
	assert.Equal(t, "1.0.0", deploy.GetVersion())

	features := deploy.GetFeatures()
	assert.Contains(t, features, DeploymentFeatureAzureFunctions)
	assert.Contains(t, features, DeploymentFeatureTerraform)
	assert.Contains(t, features, DeploymentFeatureCICD)
	assert.Contains(t, features, DeploymentFeatureMonitoring)
}

func TestAzureFunctionsDeployment_Generate(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "test-api",
			Title:       "Test API",
			Description: "Test API Description",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				Path:        "/users",
				Method:      "GET",
				Name:        "getUsers",
				Description: "Retrieves a list of all users",
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "azure-functions",
		AzureRegion:  "eastus",
		Runtime:      "nodejs18",
		MemorySize:   256,
		Timeout:      60,
		UseTerraform: true,
		CICDProvider: "github-actions",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)
	assert.NotNil(t, pkg)
	assert.Equal(t, "azure-functions", pkg.Platform)
	assert.Greater(t, len(pkg.Files), 0)
	assert.Equal(t, "eastus", pkg.Metadata.Region)
	assert.Equal(t, "nodejs18", pkg.Metadata.Runtime)
}

func TestAzureFunctionsDeployment_GenerateTerraform(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:     "azure-functions",
		AzureRegion:  "westus2",
		Runtime:      "python311",
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

func TestAzureFunctionsDeployment_GenerateTerraformMain(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:     "azure-functions",
		AzureRegion:  "northeurope",
		Runtime:      "nodejs20",
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
	assert.Contains(t, mainContent, "azurerm")
	assert.Contains(t, mainContent, "azurerm_linux_function_app")
	assert.Contains(t, mainContent, "azurerm_storage_account")
	assert.Contains(t, mainContent, "azurerm_application_insights")
}

func TestAzureFunctionsDeployment_GenerateDeploymentScripts(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:    "azure-functions",
		AzureRegion: "eastus",
		Runtime:     "nodejs18",
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

func TestAzureFunctionsDeployment_GenerateCICDGitHub(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:     "azure-functions",
		AzureRegion:  "eastus",
		Runtime:      "nodejs18",
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
	assert.Contains(t, workflowContent, "name: Deploy to Azure Functions")
	assert.Contains(t, workflowContent, "azure/login")
	assert.Contains(t, workflowContent, "Azure/functions-action")
}

func TestAzureFunctionsDeployment_GenerateCICDAzureDevOps(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "azdo-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "azure-functions",
		AzureRegion:  "eastus",
		Runtime:      "nodejs18",
		CICDProvider: "azure-devops",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find Azure DevOps pipeline
	var pipelineContent string
	for _, file := range pkg.Files {
		if file.Path == "azure-pipelines.yml" {
			pipelineContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, pipelineContent)
	assert.Contains(t, pipelineContent, "trigger:")
	assert.Contains(t, pipelineContent, "AzureFunctionApp@1")
}

func TestAzureFunctionsDeployment_GenerateMonitoring(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:    "azure-functions",
		AzureRegion: "eastus",
		Runtime:     "nodejs18",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for monitoring files
	fileMap := make(map[string]bool)
	for _, file := range pkg.Files {
		fileMap[file.Path] = true
	}

	assert.True(t, fileMap["monitoring/app-insights-queries.json"])
	assert.True(t, fileMap["monitoring/alert-rules.json"])
}

func TestAzureFunctionsDeployment_WithAuth(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:     "azure-functions",
		AzureRegion:  "eastus",
		Runtime:      "nodejs18",
		UseTerraform: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for Key Vault resources in Terraform
	var mainContent string
	for _, file := range pkg.Files {
		if file.Path == "terraform/main.tf" {
			mainContent = file.Content
			break
		}
	}

	assert.Contains(t, mainContent, "azurerm_key_vault")
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "API_KEY")
}

func TestAzureFunctionsDeployment_Statistics(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:     "azure-functions",
		AzureRegion:  "eastus",
		Runtime:      "nodejs18",
		UseTerraform: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check statistics
	assert.Greater(t, pkg.Statistics.TotalFiles, 0)
	assert.Greater(t, pkg.Statistics.ConfigFiles, 0)
	assert.Greater(t, pkg.Statistics.ScriptFiles, 0)
	assert.Greater(t, pkg.Statistics.GenerationTime.Nanoseconds(), int64(0))
	assert.GreaterOrEqual(t, pkg.Statistics.EstimatedCost, 0.0)
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "API_KEY")
}

func TestAzureFunctionsDeployment_EstimateCost(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()

	ir := &parser.IntermediateRepresentation{
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
	}

	opts := DeploymentOptions{
		MemorySize: 512,
		Timeout:    30,
	}

	cost := deploy.estimateMonthlyCost(ir, opts)

	assert.GreaterOrEqual(t, cost, 0.0)
	assert.Less(t, cost, 100.0) // Sanity check
}

func TestAzureFunctionsDeployment_VPCConfig(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:         "azure-functions",
		AzureRegion:      "eastus",
		Runtime:          "nodejs18",
		UseVPC:           true,
		UseTerraform:     true,
		SecurityGroupIDs: []string{"sg-12345"},
		SubnetIDs:        []string{"subnet-12345"},
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find main.tf and check for VNet config
	var mainContent string
	for _, file := range pkg.Files {
		if file.Path == "terraform/main.tf" {
			mainContent = file.Content
			break
		}
	}

	assert.Contains(t, mainContent, "azurerm_virtual_network")
	assert.Contains(t, mainContent, "azurerm_subnet")
	assert.True(t, pkg.Metadata.HasVPC)
}

func TestAzureFunctionsDeployment_AutoScaling(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "autoscale-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:          "azure-functions",
		AzureRegion:       "eastus",
		Runtime:           "nodejs18",
		EnableAutoScaling: true,
		UseTerraform:      true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find main.tf and check for autoscale config
	var mainContent string
	for _, file := range pkg.Files {
		if file.Path == "terraform/main.tf" {
			mainContent = file.Content
			break
		}
	}

	assert.Contains(t, mainContent, "azurerm_monitor_autoscale_setting")
	assert.True(t, pkg.Metadata.HasAutoScaling)
}

func TestAzureFunctionsDeployment_FileTypes(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:     "azure-functions",
		AzureRegion:  "eastus",
		Runtime:      "nodejs18",
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

func TestAzureFunctionsDeployment_OAuth2Auth(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
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
		Platform:     "azure-functions",
		AzureRegion:  "eastus",
		Runtime:      "nodejs18",
		UseTerraform: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check required secrets
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "CLIENT_ID")
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "CLIENT_SECRET")
}

func TestAzureFunctionsDeployment_NodeRuntime(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "node-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:    "azure-functions",
		AzureRegion: "eastus",
		Runtime:     "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for package.json
	var packageJSON string
	for _, file := range pkg.Files {
		if file.Path == "package.json" {
			packageJSON = file.Content
			break
		}
	}

	assert.NotEmpty(t, packageJSON)
	assert.Contains(t, packageJSON, "@azure/functions")
}

func TestAzureFunctionsDeployment_PythonRuntime(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "python-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:    "azure-functions",
		AzureRegion: "eastus",
		Runtime:     "python311",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for requirements.txt
	var requirements string
	for _, file := range pkg.Files {
		if file.Path == "requirements.txt" {
			requirements = file.Content
			break
		}
	}

	assert.NotEmpty(t, requirements)
	assert.Contains(t, requirements, "azure-functions")
}

func TestAzureFunctionsDeployment_HostJSON(t *testing.T) {
	deploy := NewAzureFunctionsDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "host-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:    "azure-functions",
		AzureRegion: "eastus",
		Runtime:     "nodejs18",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for host.json
	var hostJSON string
	for _, file := range pkg.Files {
		if file.Path == "host.json" {
			hostJSON = file.Content
			break
		}
	}

	assert.NotEmpty(t, hostJSON)
	assert.Contains(t, hostJSON, "version")
	assert.Contains(t, hostJSON, "applicationInsights")
}
