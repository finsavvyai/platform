package deployment

import (
	"context"
	"fmt"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// GCPFunctionsDeployment handles Google Cloud Functions deployment automation
type GCPFunctionsDeployment struct {
	*BaseDeployment
}

// NewGCPFunctionsDeployment creates a new GCP Functions deployment handler
func NewGCPFunctionsDeployment() *GCPFunctionsDeployment {
	features := []DeploymentFeature{
		DeploymentFeatureGCPFunctions,
		DeploymentFeatureTerraform,
		DeploymentFeatureCICD,
		DeploymentFeatureMonitoring,
		DeploymentFeatureAutoScaling,
		DeploymentFeatureEnvironmentVariables,
		DeploymentFeatureSecrets,
		DeploymentFeatureVPC,
		DeploymentFeatureIAMRoles,
		DeploymentFeatureCloudWatch,
	}

	return &GCPFunctionsDeployment{
		BaseDeployment: NewBaseDeployment("gcp-functions", "1.0.0", features),
	}
}

// Generate generates GCP Functions deployment files
func (d *GCPFunctionsDeployment) Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts DeploymentOptions) (*DeploymentPackage, error) {
	startTime := time.Now()

	files := []DeploymentFile{}

	// Generate Terraform files
	if opts.UseTerraform {
		tfFiles, err := d.generateTerraformDeployment(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate Terraform deployment: %w", err)
		}
		files = append(files, tfFiles...)
	}

	// Generate Cloud Build configuration
	buildFiles, err := d.generateCloudBuild(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate Cloud Build: %w", err)
	}
	files = append(files, buildFiles...)

	// Generate deployment scripts
	scriptFiles, err := d.generateDeploymentScripts(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate deployment scripts: %w", err)
	}
	files = append(files, scriptFiles...)

	// Generate CI/CD pipeline files
	cicdFiles, err := d.generateCICDPipeline(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate CI/CD pipeline: %w", err)
	}
	files = append(files, cicdFiles...)

	// Generate monitoring configuration
	monitoringFiles, err := d.generateMonitoringConfig(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate monitoring config: %w", err)
	}
	files = append(files, monitoringFiles...)

	// Create deployment package
	pkg := &DeploymentPackage{
		Platform:  "gcp-functions",
		Files:     files,
		CreatedAt: time.Now(),
		Metadata: DeploymentMetadata{
			Platform:       "gcp-functions",
			Region:         opts.GCPRegion,
			Runtime:        opts.Runtime,
			MemorySize:     opts.MemorySize,
			Timeout:        opts.Timeout,
			HasVPC:         opts.UseVPC,
			HasMonitoring:  true,
			HasAutoScaling: opts.EnableAutoScaling,
			Extensions: map[string]interface{}{
				"terraform_enabled": opts.UseTerraform,
				"endpoints_count":   len(ir.Endpoints),
				"project_id":        opts.GCPProjectID,
			},
		},
		Statistics: DeploymentStatistics{
			TotalFiles:      len(files),
			ConfigFiles:     d.countFilesByType(files, FileTypeConfig),
			ScriptFiles:     d.countFilesByType(files, FileTypeScript),
			GenerationTime:  time.Since(startTime),
			EstimatedCost:   d.estimateMonthlyCost(ir, opts),
			RequiredSecrets: d.extractRequiredSecrets(ir),
		},
	}

	return pkg, nil
}

// generateTerraformDeployment generates Terraform deployment files for GCP
func (d *GCPFunctionsDeployment) generateTerraformDeployment(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
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
	variablesTF, err := d.generateTerraformVariables(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "terraform/variables.tf",
		Content:  variablesTF,
		FileType: FileTypeConfig,
	})

	// Generate outputs.tf
	outputsTF, err := d.generateTerraformOutputs(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "terraform/outputs.tf",
		Content:  outputsTF,
		FileType: FileTypeConfig,
	})

	// Generate backend.tf
	backendTF, err := d.generateTerraformBackend(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "terraform/backend.tf",
		Content:  backendTF,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// generateTerraformMain generates main.tf for GCP Functions
func (d *GCPFunctionsDeployment) generateTerraformMain(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	functionName := d.sanitizeResourceName(ir.Metadata.Name)

	mainTF := fmt.Sprintf(`# Terraform configuration for %s GCP Functions

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  default_labels = {
    application = "mcp-connector"
    service     = "%s"
    managed_by  = "terraform"
    environment = var.environment
  }
}

# Data sources
data "google_project" "current" {}

# Archive function code
data "archive_file" "function" {
  type        = "zip"
  source_dir  = "../"
  output_path = "${path.module}/function.zip"
  excludes = [
    "terraform",
    ".git",
    "*.md",
  ]
}

# Cloud Storage bucket for function source code
resource "google_storage_bucket" "function_bucket" {
  name     = "${var.project_id}-${var.function_name}-source"
  location = var.region

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

# Upload function source code to bucket
resource "google_storage_bucket_object" "function_archive" {
  name   = "function-source-${data.archive_file.function.output_md5}.zip"
  bucket = google_storage_bucket.function_bucket.name
  source = data.archive_file.function.output_path

  depends_on = [data.archive_file.function]
}

# Service account for Cloud Function
resource "google_service_account" "function_sa" {
  account_id   = "${var.function_name}-sa"
  display_name = "Service Account for ${var.function_name}"
  description  = "Service account used by Cloud Function ${var.function_name}"
}

# IAM roles for service account
resource "google_project_iam_member" "function_invoker" {
  project = var.project_id
  role    = "roles/cloudfunctions.invoker"
  member  = "serviceAccount:${google_service_account.function_sa.email}"
}

resource "google_project_iam_member" "logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.function_sa.email}"
}

resource "google_project_iam_member" "monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.function_sa.email}"
}

%s

# Cloud Function (Gen 2)
resource "google_cloudfunctions2_function" "main" {
  name        = var.function_name
  location    = var.region
  description = "%s"

  build_config {
    runtime     = var.runtime
    entry_point = "handler"

    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.function_archive.name
      }
    }
  }

  service_config {
    max_instance_count = var.max_instances
    min_instance_count = var.min_instances
    available_memory   = "${var.memory_size}Mi"
    timeout_seconds    = var.timeout

    environment_variables = merge(
      {
        LOG_LEVEL        = var.log_level
        API_BASE_URL     = "%s"
        SERVICE_NAME     = "%s"
      },
      var.environment_variables
    )

    service_account_email = google_service_account.function_sa.email

%s
  }

  labels = {
    application = "mcp-connector"
    service     = "%s"
  }

  depends_on = [
    google_storage_bucket_object.function_archive,
    google_project_iam_member.function_invoker,
    google_project_iam_member.logging,
    google_project_iam_member.monitoring,
  ]
}

# API Gateway for HTTP routing
resource "google_api_gateway_api" "main" {
  provider = google
  api_id   = "${var.function_name}-api"
}

resource "google_api_gateway_api_config" "main" {
  provider      = google
  api           = google_api_gateway_api.main.api_id
  api_config_id = "${var.function_name}-config"

  openapi_documents {
    document {
      path = "openapi.yaml"
      contents = base64encode(templatefile("${path.module}/openapi.yaml.tpl", {
        function_url = google_cloudfunctions2_function.main.service_config[0].uri
      }))
    }
  }

  gateway_config {
    backend_config {
      google_service_account = google_service_account.function_sa.email
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_api_gateway_gateway" "main" {
  provider   = google
  api_config = google_api_gateway_api_config.main.id
  gateway_id = "${var.function_name}-gateway"
  region     = var.region
}

# Allow public access (optional - can be restricted)
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloudfunctions2_function.main.location
  service  = google_cloudfunctions2_function.main.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

%s

%s

%s
`,
		ir.Metadata.Title,
		functionName,
		d.generateTerraformSecretsResources(ir, opts),
		ir.Metadata.Description,
		d.getAPIBaseURL(ir),
		functionName,
		d.generateTerraformVPCConfig(opts),
		functionName,
		d.generateTerraformMonitoring(ir, functionName, opts),
		d.generateTerraformAlerting(ir, functionName, opts),
		d.generateTerraformScheduler(ir, functionName, opts),
	)

	return mainTF, nil
}

// generateTerraformVariables generates variables.tf for GCP
func (d *GCPFunctionsDeployment) generateTerraformVariables(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	variables := fmt.Sprintf(`variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "%s"
}

variable "region" {
  description = "GCP region for deployment"
  type        = string
  default     = "%s"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "function_name" {
  description = "Name of the Cloud Function"
  type        = string
  default     = "%s"
}

variable "runtime" {
  description = "Cloud Function runtime"
  type        = string
  default     = "%s"
}

variable "memory_size" {
  description = "Memory allocation in MB"
  type        = number
  default     = %d
}

variable "timeout" {
  description = "Function timeout in seconds"
  type        = number
  default     = %d
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 100
}

variable "log_level" {
  description = "Log level"
  type        = string
  default     = "INFO"
}

variable "environment_variables" {
  description = "Additional environment variables"
  type        = map(string)
  default     = {}
}

%s
`,
		opts.GCPProjectID,
		opts.GCPRegion,
		d.sanitizeResourceName(ir.Metadata.Name),
		opts.Runtime,
		opts.MemorySize,
		opts.Timeout,
		d.generateTerraformAuthVariables(ir),
	)

	return variables, nil
}

// generateTerraformOutputs generates outputs.tf
func (d *GCPFunctionsDeployment) generateTerraformOutputs(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	outputs := `output "function_url" {
  description = "Cloud Function URL"
  value       = google_cloudfunctions2_function.main.service_config[0].uri
}

output "function_name" {
  description = "Cloud Function name"
  value       = google_cloudfunctions2_function.main.name
}

output "gateway_url" {
  description = "API Gateway URL"
  value       = google_api_gateway_gateway.main.default_hostname
}

output "service_account_email" {
  description = "Service Account email"
  value       = google_service_account.function_sa.email
}
`
	return outputs, nil
}

// generateTerraformBackend generates backend.tf
func (d *GCPFunctionsDeployment) generateTerraformBackend(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	backend := `# Terraform backend configuration
# Uncomment and configure for remote state storage

# terraform {
#   backend "gcs" {
#     bucket = "your-terraform-state-bucket"
#     prefix = "mcp-connector/terraform.tfstate"
#   }
# }
`
	return backend, nil
}

// generateCloudBuild generates cloudbuild.yaml
func (d *GCPFunctionsDeployment) generateCloudBuild(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	cloudBuild := fmt.Sprintf(`steps:
  # Install dependencies
  - name: 'gcr.io/cloud-builders/npm'
    args: ['install']
    id: 'install-deps'

  # Run tests
  - name: 'gcr.io/cloud-builders/npm'
    args: ['test']
    id: 'run-tests'
    waitFor: ['install-deps']

  # Deploy function
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'functions'
      - 'deploy'
      - '%s'
      - '--gen2'
      - '--runtime=%s'
      - '--region=%s'
      - '--source=.'
      - '--entry-point=handler'
      - '--trigger-http'
      - '--allow-unauthenticated'
      - '--memory=%dMB'
      - '--timeout=%ds'
    id: 'deploy-function'
    waitFor: ['run-tests']

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'N1_HIGHCPU_8'

timeout: '1200s'
`,
		d.sanitizeResourceName(ir.Metadata.Name),
		opts.Runtime,
		opts.GCPRegion,
		opts.MemorySize,
		opts.Timeout,
	)

	files = append(files, DeploymentFile{
		Path:     "cloudbuild.yaml",
		Content:  cloudBuild,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// generateDeploymentScripts generates deployment scripts
func (d *GCPFunctionsDeployment) generateDeploymentScripts(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Deploy script
	deployScript := fmt.Sprintf(`#!/bin/bash
# Deployment script for %s GCP Functions

set -e

# Configuration
FUNCTION_NAME="${FUNCTION_NAME:-%s}"
PROJECT_ID="${PROJECT_ID:-%s}"
REGION="${REGION:-%s}"
RUNTIME="${RUNTIME:-%s}"
MEMORY="${MEMORY:-256}"
TIMEOUT="${TIMEOUT:-60}"

echo "Deploying ${FUNCTION_NAME} to GCP..."

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo "gcloud CLI not found. Please install it first."
    exit 1
fi

# Set project
echo "Setting project to ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}"

# Deploy function
echo "Deploying Cloud Function..."
gcloud functions deploy "${FUNCTION_NAME}" \
    --gen2 \
    --runtime="${RUNTIME}" \
    --region="${REGION}" \
    --source=. \
    --entry-point=handler \
    --trigger-http \
    --allow-unauthenticated \
    --memory="${MEMORY}MB" \
    --timeout="${TIMEOUT}s"

# Get function URL
echo "Getting function URL..."
FUNCTION_URL=$(gcloud functions describe "${FUNCTION_NAME}" \
    --gen2 \
    --region="${REGION}" \
    --format="value(serviceConfig.uri)")

echo "Deployment complete!"
echo "Function URL: ${FUNCTION_URL}"
`,
		ir.Metadata.Title,
		d.sanitizeResourceName(ir.Metadata.Name),
		opts.GCPProjectID,
		opts.GCPRegion,
		opts.Runtime,
	)

	files = append(files, DeploymentFile{
		Path:     "scripts/deploy.sh",
		Content:  deployScript,
		FileType: FileTypeScript,
	})

	// Test script
	testScript := `#!/bin/bash
# Test script for GCP Functions

set -e

echo "Running tests..."

# Run tests
npm test

echo "Tests complete!"
`
	files = append(files, DeploymentFile{
		Path:     "scripts/test.sh",
		Content:  testScript,
		FileType: FileTypeScript,
	})

	// Cleanup script
	cleanupScript := fmt.Sprintf(`#!/bin/bash
# Cleanup script for %s GCP Functions

set -e

# Configuration
FUNCTION_NAME="${FUNCTION_NAME:-%s}"
PROJECT_ID="${PROJECT_ID:-%s}"
REGION="${REGION:-%s}"

echo "WARNING: This will delete the function ${FUNCTION_NAME} in ${PROJECT_ID}"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo "Deleting function..."
gcloud functions delete "${FUNCTION_NAME}" \
    --gen2 \
    --region="${REGION}" \
    --quiet

echo "Cleanup complete!"
`,
		ir.Metadata.Title,
		d.sanitizeResourceName(ir.Metadata.Name),
		opts.GCPProjectID,
		opts.GCPRegion,
	)

	files = append(files, DeploymentFile{
		Path:     "scripts/cleanup.sh",
		Content:  cleanupScript,
		FileType: FileTypeScript,
	})

	return files, nil
}

// generateCICDPipeline generates CI/CD pipeline files
func (d *GCPFunctionsDeployment) generateCICDPipeline(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// GitHub Actions workflow
	if opts.CICDProvider == "github-actions" || opts.CICDProvider == "" {
		githubWorkflow := fmt.Sprintf(`name: Deploy to GCP Functions

on:
  push:
    branches:
      - main
      - staging
      - develop
  pull_request:
    branches:
      - main

env:
  GCP_PROJECT_ID: %s
  GCP_REGION: %s
  FUNCTION_NAME: %s

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

  deploy-dev:
    name: Deploy to Development
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/develop'
    environment: development
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to Cloud Functions
        run: |
          gcloud functions deploy ${{ env.FUNCTION_NAME }}-dev \
            --gen2 \
            --runtime=nodejs20 \
            --region=${{ env.GCP_REGION }} \
            --source=. \
            --entry-point=handler \
            --trigger-http \
            --allow-unauthenticated

  deploy-prod:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to Cloud Functions
        run: |
          gcloud functions deploy ${{ env.FUNCTION_NAME }}-prod \
            --gen2 \
            --runtime=nodejs20 \
            --region=${{ env.GCP_REGION }} \
            --source=. \
            --entry-point=handler \
            --trigger-http \
            --allow-unauthenticated
`,
			opts.GCPProjectID,
			opts.GCPRegion,
			d.sanitizeResourceName(ir.Metadata.Name),
		)

		files = append(files, DeploymentFile{
			Path:     ".github/workflows/deploy.yml",
			Content:  githubWorkflow,
			FileType: FileTypeConfig,
		})
	}

	return files, nil
}

// generateMonitoringConfig generates monitoring configuration
func (d *GCPFunctionsDeployment) generateMonitoringConfig(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Cloud Monitoring alert policies
	alertsConfig := `{
  "alertPolicies": [
    {
      "displayName": "Function Error Rate High",
      "conditions": [
        {
          "displayName": "Error rate > 5%",
          "conditionThreshold": {
            "filter": "resource.type=\"cloud_function\" AND metric.type=\"cloudfunctions.googleapis.com/function/execution_count\" AND metric.label.status=\"error\"",
            "comparison": "COMPARISON_GT",
            "thresholdValue": 5,
            "duration": "300s"
          }
        }
      ]
    }
  ]
}
`
	files = append(files, DeploymentFile{
		Path:     "monitoring/alerts.json",
		Content:  alertsConfig,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// Helper methods
func (d *GCPFunctionsDeployment) generateTerraformSecretsResources(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	if len(ir.Auth) == 0 {
		return ""
	}
	return `
# Secret Manager for storing API credentials
resource "google_secret_manager_secret" "api_credentials" {
  secret_id = "${var.function_name}-credentials"

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_iam_member" "secret_access" {
  secret_id = google_secret_manager_secret.api_credentials.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.function_sa.email}"
}`
}

func (d *GCPFunctionsDeployment) generateTerraformVPCConfig(opts DeploymentOptions) string {
	if !opts.UseVPC {
		return ""
	}
	return `
    vpc_connector = var.vpc_connector
    vpc_connector_egress_settings = "PRIVATE_RANGES_ONLY"`
}

func (d *GCPFunctionsDeployment) generateTerraformAuthVariables(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		return `variable "api_key" {
  description = "API Key for authentication"
  type        = string
  sensitive   = true
}`
	case "http":
		if auth.Scheme == "bearer" {
			return `variable "bearer_token" {
  description = "Bearer token for authentication"
  type        = string
  sensitive   = true
}`
		}
	case "oauth2":
		return `variable "client_id" {
  description = "OAuth2 Client ID"
  type        = string
}

variable "client_secret" {
  description = "OAuth2 Client Secret"
  type        = string
  sensitive   = true
}`
	}
	return ""
}

func (d *GCPFunctionsDeployment) generateTerraformMonitoring(ir *parser.IntermediateRepresentation, functionName string, opts DeploymentOptions) string {
	return `
# Cloud Monitoring alert policy
resource "google_monitoring_alert_policy" "function_errors" {
  display_name = "${var.function_name}-error-rate"
  combiner     = "OR"

  conditions {
    display_name = "Error rate > 5%"

    condition_threshold {
      filter          = "resource.type=\"cloud_function\" AND resource.labels.function_name=\"${var.function_name}\" AND metric.type=\"cloudfunctions.googleapis.com/function/execution_count\" AND metric.labels.status=\"error\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5
    }
  }

  notification_channels = []
}`
}

func (d *GCPFunctionsDeployment) generateTerraformAlerting(ir *parser.IntermediateRepresentation, functionName string, opts DeploymentOptions) string {
	return `
# Cloud Monitoring dashboard
resource "google_monitoring_dashboard" "main" {
  dashboard_json = jsonencode({
    displayName = "${var.function_name} Dashboard"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Function Invocations"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloud_function\" AND resource.labels.function_name=\"${var.function_name}\" AND metric.type=\"cloudfunctions.googleapis.com/function/execution_count\""
                  }
                }
              }]
            }
          }
        }
      ]
    }
  })
}`
}

func (d *GCPFunctionsDeployment) generateTerraformScheduler(ir *parser.IntermediateRepresentation, functionName string, opts DeploymentOptions) string {
	return ""
}

func (d *GCPFunctionsDeployment) getAPIBaseURL(ir *parser.IntermediateRepresentation) string {
	if len(ir.Servers) > 0 {
		return ir.Servers[0].URL
	}
	return "https://api.example.com"
}

func (d *GCPFunctionsDeployment) estimateMonthlyCost(ir *parser.IntermediateRepresentation, opts DeploymentOptions) float64 {
	// GCP Functions pricing: $0.40 per million invocations + compute time
	requestsPerMonth := 100000.0
	avgDurationMS := float64(opts.Timeout) * 0.5
	memoryGB := float64(opts.MemorySize) / 1024.0

	invocationCost := (requestsPerMonth / 1000000.0) * 0.40
	computeCost := (requestsPerMonth * avgDurationMS / 1000.0 * memoryGB) * 0.0000025

	return invocationCost + computeCost
}

func (d *GCPFunctionsDeployment) extractRequiredSecrets(ir *parser.IntermediateRepresentation) []string {
	secrets := []string{}

	if len(ir.Auth) > 0 {
		auth := ir.Auth[0]
		switch auth.Type {
		case "apiKey":
			secrets = append(secrets, "API_KEY")
		case "http":
			if auth.Scheme == "bearer" {
				secrets = append(secrets, "BEARER_TOKEN")
			}
		case "oauth2":
			secrets = append(secrets, "CLIENT_ID", "CLIENT_SECRET")
		}
	}

	return secrets
}
