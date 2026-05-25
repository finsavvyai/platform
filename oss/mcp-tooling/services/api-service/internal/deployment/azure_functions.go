package deployment

import (
	"context"
	"fmt"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// AzureFunctionsDeployment implements Azure Functions deployment
type AzureFunctionsDeployment struct {
	BaseDeployment
}

// NewAzureFunctionsDeployment creates a new Azure Functions deployment provider
func NewAzureFunctionsDeployment() *AzureFunctionsDeployment {
	return &AzureFunctionsDeployment{
		BaseDeployment: BaseDeployment{
			name:    "azure-functions",
			version: "1.0.0",
			features: []DeploymentFeature{
				DeploymentFeatureAzureFunctions,
				DeploymentFeatureTerraform,
				DeploymentFeatureCICD,
				DeploymentFeatureMonitoring,
				DeploymentFeatureAutoScaling,
				DeploymentFeatureVPC,
				DeploymentFeatureSecretsManager,
			},
		},
	}
}

// Generate generates Azure Functions deployment configuration
func (d *AzureFunctionsDeployment) Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts DeploymentOptions) (*DeploymentPackage, error) {
	startTime := time.Now()

	// Validate options
	if err := d.ValidateOptions(opts); err != nil {
		return nil, fmt.Errorf("invalid options: %w", err)
	}

	pkg := &DeploymentPackage{
		Platform:  "azure-functions",
		CreatedAt: time.Now(),
		Files:     []DeploymentFile{},
		Metadata: DeploymentMetadata{
			Platform:       "azure-functions",
			Region:         opts.AzureRegion,
			Runtime:        opts.Runtime,
			MemorySize:     opts.MemorySize,
			Timeout:        opts.Timeout,
			HasVPC:         opts.UseVPC,
			HasMonitoring:  true,
			HasAutoScaling: opts.EnableAutoScaling,
		},
	}

	// Generate Terraform infrastructure
	if opts.UseTerraform {
		terraformFiles, err := d.generateTerraform(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate terraform: %w", err)
		}
		pkg.Files = append(pkg.Files, terraformFiles...)
	}

	// Generate deployment scripts
	scriptFiles, err := d.generateDeploymentScripts(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate deployment scripts: %w", err)
	}
	pkg.Files = append(pkg.Files, scriptFiles...)

	// Generate CI/CD pipeline
	if opts.CICDProvider != "" {
		cicdFiles, err := d.generateCICD(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate CI/CD: %w", err)
		}
		pkg.Files = append(pkg.Files, cicdFiles...)
	}

	// Generate monitoring configuration
	monitoringFiles, err := d.generateMonitoring(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate monitoring: %w", err)
	}
	pkg.Files = append(pkg.Files, monitoringFiles...)

	// Generate function code template
	functionFiles, err := d.generateFunctionCode(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate function code: %w", err)
	}
	pkg.Files = append(pkg.Files, functionFiles...)

	// Calculate statistics
	pkg.Statistics = d.calculateStatistics(pkg, ir, opts, time.Since(startTime))

	return pkg, nil
}

// Deploy performs the actual deployment
func (d *AzureFunctionsDeployment) Deploy(ctx context.Context, pkg *DeploymentPackage, opts DeploymentOptions) (*DeploymentResult, error) {
	return &DeploymentResult{
		Success:      false,
		DeploymentID: "",
		Endpoint:     "",
		Errors:       []string{"deployment not yet implemented - use generated scripts"},
	}, nil
}

// generateTerraform generates Terraform configuration files
func (d *AzureFunctionsDeployment) generateTerraform(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate main.tf
	mainTF, err := d.generateTerraformMain(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "terraform/main.tf",
		Content:  mainTF,
		FileType: FileTypeConfig,
	})

	// Generate variables.tf
	variablesTF := d.generateTerraformVariables(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "terraform/variables.tf",
		Content:  variablesTF,
		FileType: FileTypeConfig,
	})

	// Generate outputs.tf
	outputsTF := d.generateTerraformOutputs(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "terraform/outputs.tf",
		Content:  outputsTF,
		FileType: FileTypeConfig,
	})

	// Generate backend.tf
	backendTF := d.generateTerraformBackend(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "terraform/backend.tf",
		Content:  backendTF,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// generateTerraformMain generates the main Terraform configuration
func (d *AzureFunctionsDeployment) generateTerraformMain(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	_ = d.sanitizeResourceName(ir.Metadata.Name)
	hasAuth := len(ir.Auth) > 0

	mainTF := fmt.Sprintf(`terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location

  tags = var.tags
}

# Storage Account (required for Azure Functions)
resource "azurerm_storage_account" "functions" {
  name                     = "${replace(var.function_app_name, "-", "")}storage"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = var.tags
}

# Application Insights for monitoring
resource "azurerm_application_insights" "functions" {
  name                = "${var.function_app_name}-insights"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  application_type    = "web"

  tags = var.tags
}

# App Service Plan
resource "azurerm_service_plan" "functions" {
  name                = "${var.function_app_name}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = var.sku_name

  tags = var.tags
}

# Function App
resource "azurerm_linux_function_app" "main" {
  name                       = var.function_app_name
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  service_plan_id            = azurerm_service_plan.functions.id
  storage_account_name       = azurerm_storage_account.functions.name
  storage_account_access_key = azurerm_storage_account.functions.primary_access_key

  site_config {
    application_stack {
      %s
    }

    application_insights_key               = azurerm_application_insights.functions.instrumentation_key
    application_insights_connection_string = azurerm_application_insights.functions.connection_string

    cors {
      allowed_origins = ["*"]
    }
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME" = "%s"
    "APPINSIGHTS_INSTRUMENTATIONKEY" = azurerm_application_insights.functions.instrumentation_key
    %s
  }

  tags = var.tags
}
`, d.getApplicationStack(opts.Runtime), d.getRuntimeName(opts.Runtime), d.generateAuthAppSettings(ir))

	// Add VPC configuration if enabled
	if opts.UseVPC {
		mainTF += `
# Virtual Network
resource "azurerm_virtual_network" "functions" {
  name                = "${var.function_app_name}-vnet"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  address_space       = ["10.0.0.0/16"]

  tags = var.tags
}

# Subnet for Function App
resource "azurerm_subnet" "functions" {
  name                 = "${var.function_app_name}-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.functions.name
  address_prefixes     = ["10.0.1.0/24"]

  delegation {
    name = "function-delegation"

    service_delegation {
      name = "Microsoft.Web/serverFarms"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/action",
      ]
    }
  }
}

# VNet Integration
resource "azurerm_app_service_virtual_network_swift_connection" "functions" {
  app_service_id = azurerm_linux_function_app.main.id
  subnet_id      = azurerm_subnet.functions.id
}
`
	}

	// Add Key Vault for secrets if auth is enabled
	if hasAuth {
		mainTF += `
# Key Vault for secrets
resource "azurerm_key_vault" "functions" {
  name                       = "${replace(var.function_app_name, "-", "")}kv"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = azurerm_linux_function_app.main.identity[0].principal_id

    secret_permissions = [
      "Get",
      "List",
    ]
  }

  tags = var.tags
}

data "azurerm_client_config" "current" {}
`
	}

	// Add auto-scaling configuration
	if opts.EnableAutoScaling {
		mainTF += `
# Autoscale Settings
resource "azurerm_monitor_autoscale_setting" "functions" {
  name                = "${var.function_app_name}-autoscale"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  target_resource_id  = azurerm_service_plan.functions.id

  profile {
    name = "default"

    capacity {
      default = 1
      minimum = 1
      maximum = var.max_instances
    }

    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.functions.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 75
      }

      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.functions.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = 25
      }

      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
  }

  tags = var.tags
}
`
	}

	return mainTF, nil
}

// generateTerraformVariables generates Terraform variables
func (d *AzureFunctionsDeployment) generateTerraformVariables(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	functionName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "%s-rg"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "%s"
}

variable "function_app_name" {
  description = "Name of the Function App"
  type        = string
  default     = "%s"
}

variable "sku_name" {
  description = "SKU for the App Service Plan"
  type        = string
  default     = "Y1"  # Consumption plan
}

variable "max_instances" {
  description = "Maximum number of instances for auto-scaling"
  type        = number
  default     = 10
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Environment = "production"
    ManagedBy   = "Terraform"
    Project     = "%s"
  }
}
`, functionName, opts.AzureRegion, functionName, ir.Metadata.Name)
}

// generateTerraformOutputs generates Terraform outputs
func (d *AzureFunctionsDeployment) generateTerraformOutputs(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir
	_ = opts

	return `output "function_app_name" {
  description = "Name of the Function App"
  value       = azurerm_linux_function_app.main.name
}

output "function_app_url" {
  description = "Default hostname of the Function App"
  value       = azurerm_linux_function_app.main.default_hostname
}

output "function_app_id" {
  description = "ID of the Function App"
  value       = azurerm_linux_function_app.main.id
}

output "application_insights_instrumentation_key" {
  description = "Application Insights instrumentation key"
  value       = azurerm_application_insights.functions.instrumentation_key
  sensitive   = true
}

output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.functions.name
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}
`
}

// generateTerraformBackend generates Terraform backend configuration
func (d *AzureFunctionsDeployment) generateTerraformBackend(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir
	_ = opts

	return `# Backend configuration for Terraform state
# Uncomment and configure for production use

# terraform {
#   backend "azurerm" {
#     resource_group_name  = "terraform-state-rg"
#     storage_account_name = "terraformstate"
#     container_name       = "tfstate"
#     key                  = "azure-functions.tfstate"
#   }
# }
`
}

// generateDeploymentScripts generates deployment automation scripts
func (d *AzureFunctionsDeployment) generateDeploymentScripts(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate deploy.sh
	deployScript := d.generateDeployScript(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "scripts/deploy.sh",
		Content:  deployScript,
		FileType: FileTypeScript,
	})

	// Generate test.sh
	testScript := d.generateTestScript(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "scripts/test.sh",
		Content:  testScript,
		FileType: FileTypeScript,
	})

	// Generate cleanup.sh
	cleanupScript := d.generateCleanupScript(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "scripts/cleanup.sh",
		Content:  cleanupScript,
		FileType: FileTypeScript,
	})

	return files, nil
}

// generateDeployScript generates deployment script
func (d *AzureFunctionsDeployment) generateDeployScript(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	functionName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`#!/bin/bash
set -e

# Azure Functions Deployment Script
# Generated by MCPOverflow

FUNCTION_APP_NAME="%s"
RESOURCE_GROUP="${FUNCTION_APP_NAME}-rg"
LOCATION="%s"
RUNTIME="%s"

echo "Deploying Azure Function: $FUNCTION_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Runtime: $RUNTIME"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Error: Azure CLI is not installed"
    echo "Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo "Not logged in to Azure. Running 'az login'..."
    az login
fi

# Deploy infrastructure with Terraform
if [ -d "terraform" ]; then
    echo "Deploying infrastructure with Terraform..."
    cd terraform
    terraform init
    terraform plan -out=tfplan
    terraform apply tfplan
    cd ..
else
    echo "No Terraform configuration found, skipping infrastructure deployment"
fi

# Build and deploy function code
echo "Building function code..."
if [ -f "package.json" ]; then
    npm install
    npm run build
elif [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi

echo "Deploying function code..."
az functionapp deployment source config-zip \
    --resource-group "$RESOURCE_GROUP" \
    --name "$FUNCTION_APP_NAME" \
    --src deploy.zip

echo "✅ Deployment complete!"
echo "Function URL: https://${FUNCTION_APP_NAME}.azurewebsites.net"
`, functionName, opts.AzureRegion, opts.Runtime)
}

// generateTestScript generates test script
func (d *AzureFunctionsDeployment) generateTestScript(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	functionName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`#!/bin/bash
set -e

# Azure Functions Test Script
# Generated by MCPOverflow

FUNCTION_APP_NAME="%s"
FUNCTION_URL="https://${FUNCTION_APP_NAME}.azurewebsites.net"

echo "Testing Azure Function: $FUNCTION_APP_NAME"

# Test health endpoint
echo "Testing health endpoint..."
curl -f "${FUNCTION_URL}/api/health" || {
    echo "❌ Health check failed"
    exit 1
}

# Test MCP manifest
echo "Testing MCP manifest..."
curl -f "${FUNCTION_URL}/.well-known/mcp.json" || {
    echo "❌ MCP manifest check failed"
    exit 1
}

echo "✅ All tests passed!"
`, functionName)
}

// generateCleanupScript generates cleanup script
func (d *AzureFunctionsDeployment) generateCleanupScript(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	functionName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`#!/bin/bash
set -e

# Azure Functions Cleanup Script
# Generated by MCPOverflow

FUNCTION_APP_NAME="%s"
RESOURCE_GROUP="${FUNCTION_APP_NAME}-rg"

echo "⚠️  This will delete all Azure resources for: $FUNCTION_APP_NAME"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled"
    exit 0
fi

echo "Deleting Azure resources..."

# Destroy Terraform resources
if [ -d "terraform" ]; then
    cd terraform
    terraform destroy -auto-approve
    cd ..
fi

# Delete resource group (backup cleanup)
az group delete --name "$RESOURCE_GROUP" --yes --no-wait

echo "✅ Cleanup initiated"
`, functionName)
}

// generateCICD generates CI/CD pipeline configuration
func (d *AzureFunctionsDeployment) generateCICD(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	switch opts.CICDProvider {
	case "github-actions":
		workflow := d.generateGitHubActionsWorkflow(ir, opts)
		files = append(files, DeploymentFile{
			Path:     ".github/workflows/deploy.yml",
			Content:  workflow,
			FileType: FileTypeConfig,
		})
	case "azure-devops":
		pipeline := d.generateAzureDevOpsPipeline(ir, opts)
		files = append(files, DeploymentFile{
			Path:     "azure-pipelines.yml",
			Content:  pipeline,
			FileType: FileTypeConfig,
		})
	}

	return files, nil
}

// generateGitHubActionsWorkflow generates GitHub Actions workflow
func (d *AzureFunctionsDeployment) generateGitHubActionsWorkflow(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	functionName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`name: Deploy to Azure Functions

on:
  push:
    branches:
      - main
      - develop
  workflow_dispatch:

env:
  AZURE_FUNCTIONAPP_NAME: %s
  AZURE_FUNCTIONAPP_PACKAGE_PATH: '.'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up runtime
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

  deploy:
    runs-on: ubuntu-latest
    needs: test
    environment:
      name: ${{ github.ref_name == 'main' && 'production' || 'development' }}

    steps:
      - uses: actions/checkout@v3

      - name: Set up runtime
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy to Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: ${{ env.AZURE_FUNCTIONAPP_NAME }}
          package: ${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}

      - name: Logout from Azure
        run: az logout
`, functionName)
}

// generateAzureDevOpsPipeline generates Azure DevOps pipeline
func (d *AzureFunctionsDeployment) generateAzureDevOpsPipeline(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	functionName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`trigger:
  branches:
    include:
      - main
      - develop

variables:
  azureSubscription: 'Azure-Service-Connection'
  functionAppName: '%s'
  vmImageName: 'ubuntu-latest'

stages:
  - stage: Test
    displayName: 'Test Stage'
    jobs:
      - job: Test
        displayName: 'Run Tests'
        pool:
          vmImage: $(vmImageName)
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
            displayName: 'Install Node.js'

          - script: |
              npm install
              npm test
            displayName: 'Install dependencies and run tests'

  - stage: Deploy
    displayName: 'Deploy Stage'
    dependsOn: Test
    condition: succeeded()
    jobs:
      - deployment: Deploy
        displayName: 'Deploy to Azure Functions'
        environment: 'production'
        pool:
          vmImage: $(vmImageName)
        strategy:
          runOnce:
            deploy:
              steps:
                - task: NodeTool@0
                  inputs:
                    versionSpec: '18.x'
                  displayName: 'Install Node.js'

                - script: |
                    npm install
                    npm run build
                  displayName: 'Build application'

                - task: AzureFunctionApp@1
                  displayName: 'Deploy Azure Function'
                  inputs:
                    azureSubscription: '$(azureSubscription)'
                    appType: 'functionAppLinux'
                    appName: '$(functionAppName)'
                    package: '$(System.DefaultWorkingDirectory)'
`, functionName)
}

// generateMonitoring generates monitoring configuration
func (d *AzureFunctionsDeployment) generateMonitoring(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate Application Insights queries
	queriesJSON := d.generateAppInsightsQueries(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "monitoring/app-insights-queries.json",
		Content:  queriesJSON,
		FileType: FileTypeConfig,
	})

	// Generate alert rules
	alertsJSON := d.generateAlertRules(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "monitoring/alert-rules.json",
		Content:  alertsJSON,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// generateAppInsightsQueries generates Application Insights queries
func (d *AzureFunctionsDeployment) generateAppInsightsQueries(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir
	_ = opts

	return `{
  "queries": [
    {
      "name": "Function Execution Count",
      "query": "requests | summarize count() by name, bin(timestamp, 1h)"
    },
    {
      "name": "Failed Requests",
      "query": "requests | where success == false | project timestamp, name, resultCode, duration"
    },
    {
      "name": "Average Response Time",
      "query": "requests | summarize avg(duration) by name, bin(timestamp, 5m)"
    },
    {
      "name": "Top 10 Slowest Requests",
      "query": "requests | top 10 by duration desc | project timestamp, name, duration, resultCode"
    },
    {
      "name": "Exception Count",
      "query": "exceptions | summarize count() by type, bin(timestamp, 1h)"
    },
    {
      "name": "Dependency Failures",
      "query": "dependencies | where success == false | project timestamp, name, type, duration"
    }
  ]
}
`
}

// generateAlertRules generates alert rules configuration
func (d *AzureFunctionsDeployment) generateAlertRules(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir
	_ = opts

	return `{
  "alertRules": [
    {
      "name": "High Error Rate",
      "description": "Alert when error rate exceeds 5%",
      "severity": "Error",
      "query": "requests | where success == false | summarize errorRate = count() * 100.0 / toscalar(requests | count())",
      "threshold": 5,
      "frequency": "PT5M",
      "timeWindow": "PT15M"
    },
    {
      "name": "Slow Response Time",
      "description": "Alert when average response time exceeds 1 second",
      "severity": "Warning",
      "query": "requests | summarize avgDuration = avg(duration)",
      "threshold": 1000,
      "frequency": "PT5M",
      "timeWindow": "PT15M"
    },
    {
      "name": "High Exception Rate",
      "description": "Alert when exception count exceeds threshold",
      "severity": "Error",
      "query": "exceptions | summarize count()",
      "threshold": 10,
      "frequency": "PT5M",
      "timeWindow": "PT15M"
    }
  ]
}
`
}

// generateFunctionCode generates function code template
func (d *AzureFunctionsDeployment) generateFunctionCode(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate host.json
	hostJSON := d.generateHostJSON(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "host.json",
		Content:  hostJSON,
		FileType: FileTypeConfig,
	})

	// Generate function.json for each endpoint
	functionJSON := d.generateFunctionJSON(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "function.json",
		Content:  functionJSON,
		FileType: FileTypeConfig,
	})

	// Generate package.json or requirements.txt based on runtime
	if d.isNodeRuntime(opts.Runtime) {
		packageJSON := d.generatePackageJSON(ir, opts)
		files = append(files, DeploymentFile{
			Path:     "package.json",
			Content:  packageJSON,
			FileType: FileTypeConfig,
		})
	} else if d.isPythonRuntime(opts.Runtime) {
		requirements := d.generateRequirements(ir, opts)
		files = append(files, DeploymentFile{
			Path:     "requirements.txt",
			Content:  requirements,
			FileType: FileTypeConfig,
		})
	}

	return files, nil
}

// generateHostJSON generates host.json configuration
func (d *AzureFunctionsDeployment) generateHostJSON(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir
	_ = opts

	return `{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[3.*, 4.0.0)"
  }
}
`
}

// generateFunctionJSON generates function.json configuration
func (d *AzureFunctionsDeployment) generateFunctionJSON(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir
	_ = opts

	return `{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"],
      "route": "{*path}"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
`
}

// generatePackageJSON generates package.json for Node.js runtime
func (d *AzureFunctionsDeployment) generatePackageJSON(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = opts

	return fmt.Sprintf(`{
  "name": "%s",
  "version": "1.0.0",
  "description": "%s",
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest"
  },
  "dependencies": {
    "@azure/functions": "^4.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0"
  }
}
`, ir.Metadata.Name, ir.Metadata.Description)
}

// generateRequirements generates requirements.txt for Python runtime
func (d *AzureFunctionsDeployment) generateRequirements(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir
	_ = opts

	return `azure-functions
requests
`
}

// Helper methods

func (d *AzureFunctionsDeployment) getApplicationStack(runtime string) string {
	if d.isNodeRuntime(runtime) {
		return `node_version = "18"`
	} else if d.isPythonRuntime(runtime) {
		return `python_version = "3.11"`
	}
	return `node_version = "18"`
}

func (d *AzureFunctionsDeployment) getRuntimeName(runtime string) string {
	if d.isNodeRuntime(runtime) {
		return "node"
	} else if d.isPythonRuntime(runtime) {
		return "python"
	}
	return "node"
}

func (d *AzureFunctionsDeployment) isNodeRuntime(runtime string) bool {
	return runtime == "nodejs18" || runtime == "nodejs20" || runtime == "node"
}

func (d *AzureFunctionsDeployment) isPythonRuntime(runtime string) bool {
	return runtime == "python39" || runtime == "python310" || runtime == "python311" || runtime == "python"
}

func (d *AzureFunctionsDeployment) generateAuthAppSettings(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	settings := ""
	for _, auth := range ir.Auth {
		switch auth.Type {
		case "apiKey":
			settings += `    "API_KEY" = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault.functions.vault_uri}secrets/api-key/)"` + "\n"
		case "oauth2":
			settings += `    "CLIENT_ID" = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault.functions.vault_uri}secrets/client-id/)"` + "\n"
			settings += `    "CLIENT_SECRET" = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault.functions.vault_uri}secrets/client-secret/)"` + "\n"
		case "http":
			settings += `    "BEARER_TOKEN" = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault.functions.vault_uri}secrets/bearer-token/)"` + "\n"
		}
	}

	return settings
}

func (d *AzureFunctionsDeployment) calculateStatistics(pkg *DeploymentPackage, ir *parser.IntermediateRepresentation, opts DeploymentOptions, duration time.Duration) DeploymentStatistics {
	stats := DeploymentStatistics{
		TotalFiles:     len(pkg.Files),
		GenerationTime: duration,
		EstimatedCost:  d.estimateMonthlyCost(ir, opts),
	}

	// Count file types
	for _, file := range pkg.Files {
		switch file.FileType {
		case FileTypeConfig:
			stats.ConfigFiles++
		case FileTypeScript:
			stats.ScriptFiles++
		}
	}

	// Collect required secrets
	secrets := []string{}
	for _, auth := range ir.Auth {
		switch auth.Type {
		case "apiKey":
			secrets = append(secrets, "API_KEY")
		case "oauth2":
			secrets = append(secrets, "CLIENT_ID", "CLIENT_SECRET")
		case "http":
			secrets = append(secrets, "BEARER_TOKEN")
		}
	}
	stats.RequiredSecrets = secrets

	return stats
}

func (d *AzureFunctionsDeployment) estimateMonthlyCost(ir *parser.IntermediateRepresentation, opts DeploymentOptions) float64 {
	// Azure Functions Consumption plan pricing
	// Free grant: 400,000 GB-s and 1,000,000 executions per month
	// Beyond free grant: $0.20 per million executions + $0.000016 per GB-s

	requestsPerMonth := 100000.0
	memoryGB := float64(opts.MemorySize) / 1024.0
	avgDurationSeconds := float64(opts.Timeout) / 2.0

	gbSeconds := requestsPerMonth * memoryGB * avgDurationSeconds

	// Subtract free grant
	freeGBSeconds := 400000.0
	freeExecutions := 1000000.0

	billableGBSeconds := 0.0
	if gbSeconds > freeGBSeconds {
		billableGBSeconds = gbSeconds - freeGBSeconds
	}

	billableExecutions := 0.0
	if requestsPerMonth > freeExecutions {
		billableExecutions = requestsPerMonth - freeExecutions
	}

	executionCost := (billableExecutions / 1000000.0) * 0.20
	computeCost := billableGBSeconds * 0.000016

	return executionCost + computeCost
}
