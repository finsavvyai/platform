package deployment

import (
	"context"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSelfHostedDeployment(t *testing.T) {
	deploy := NewSelfHostedDeployment()

	assert.NotNil(t, deploy)
	assert.Equal(t, "self-hosted", deploy.GetName())
	assert.Equal(t, "1.0.0", deploy.GetVersion())

	features := deploy.GetFeatures()
	assert.Contains(t, features, DeploymentFeatureSelfHosted)
	assert.Contains(t, features, DeploymentFeatureCICD)
	assert.Contains(t, features, DeploymentFeatureMonitoring)
}

func TestSelfHostedDeployment_Generate(t *testing.T) {
	deploy := NewSelfHostedDeployment()
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
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)
	assert.NotNil(t, pkg)
	assert.Equal(t, "self-hosted", pkg.Platform)
	assert.Greater(t, len(pkg.Files), 0)
}

func TestSelfHostedDeployment_GenerateDockerfile(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "docker-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find Dockerfile
	var dockerfileContent string
	for _, file := range pkg.Files {
		if file.Path == "Dockerfile" {
			dockerfileContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, dockerfileContent)
	assert.Contains(t, dockerfileContent, "FROM node:20-alpine")
	assert.Contains(t, dockerfileContent, "WORKDIR /app")
	assert.Contains(t, dockerfileContent, "EXPOSE 8080")
	assert.Contains(t, dockerfileContent, "HEALTHCHECK")
}

func TestSelfHostedDeployment_GenerateDockerCompose(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "compose-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find docker-compose.yml
	var composeContent string
	for _, file := range pkg.Files {
		if file.Path == "docker-compose.yml" {
			composeContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, composeContent)
	assert.Contains(t, composeContent, "version:")
	assert.Contains(t, composeContent, "services:")
	assert.Contains(t, composeContent, "prometheus:")
	assert.Contains(t, composeContent, "grafana:")
}

func TestSelfHostedDeployment_GenerateKubernetesManifests(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "k8s-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for Kubernetes manifests
	expectedFiles := []string{
		"k8s/namespace.yaml",
		"k8s/deployment.yaml",
		"k8s/service.yaml",
		"k8s/ingress.yaml",
		"k8s/configmap.yaml",
	}

	fileMap := make(map[string]bool)
	for _, file := range pkg.Files {
		fileMap[file.Path] = true
	}

	for _, expectedFile := range expectedFiles {
		assert.True(t, fileMap[expectedFile], "Expected file %s not found", expectedFile)
	}
}

func TestSelfHostedDeployment_GenerateK8sDeployment(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "k8s-deploy-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find deployment.yaml
	var deploymentContent string
	for _, file := range pkg.Files {
		if file.Path == "k8s/deployment.yaml" {
			deploymentContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, deploymentContent)
	assert.Contains(t, deploymentContent, "apiVersion: apps/v1")
	assert.Contains(t, deploymentContent, "kind: Deployment")
	assert.Contains(t, deploymentContent, "replicas: 2")
	assert.Contains(t, deploymentContent, "livenessProbe")
	assert.Contains(t, deploymentContent, "readinessProbe")
}

func TestSelfHostedDeployment_GenerateK8sService(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "k8s-service-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find service.yaml
	var serviceContent string
	for _, file := range pkg.Files {
		if file.Path == "k8s/service.yaml" {
			serviceContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, serviceContent)
	assert.Contains(t, serviceContent, "apiVersion: v1")
	assert.Contains(t, serviceContent, "kind: Service")
	assert.Contains(t, serviceContent, "type: ClusterIP")
}

func TestSelfHostedDeployment_GenerateK8sIngress(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "k8s-ingress-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find ingress.yaml
	var ingressContent string
	for _, file := range pkg.Files {
		if file.Path == "k8s/ingress.yaml" {
			ingressContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, ingressContent)
	assert.Contains(t, ingressContent, "kind: Ingress")
	assert.Contains(t, ingressContent, "kubernetes.io/ingress.class")
}

func TestSelfHostedDeployment_GenerateHPA(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "hpa-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:          "self-hosted",
		Runtime:           "nodejs20",
		EnableAutoScaling: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find hpa.yaml
	var hpaContent string
	for _, file := range pkg.Files {
		if file.Path == "k8s/hpa.yaml" {
			hpaContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, hpaContent)
	assert.Contains(t, hpaContent, "kind: HorizontalPodAutoscaler")
	assert.Contains(t, hpaContent, "minReplicas: 2")
	assert.Contains(t, hpaContent, "maxReplicas: 10")
	assert.True(t, pkg.Metadata.HasAutoScaling)
}

func TestSelfHostedDeployment_GenerateHelmChart(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "helm-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:        "self-hosted",
		Runtime:         "nodejs20",
		IncludeExamples: true,
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for Helm files
	expectedHelmFiles := []string{
		"helm/Chart.yaml",
		"helm/values.yaml",
	}

	fileMap := make(map[string]bool)
	for _, file := range pkg.Files {
		fileMap[file.Path] = true
	}

	for _, expectedFile := range expectedHelmFiles {
		assert.True(t, fileMap[expectedFile], "Expected Helm file %s not found", expectedFile)
	}
}

func TestSelfHostedDeployment_GenerateDeploymentScripts(t *testing.T) {
	deploy := NewSelfHostedDeployment()
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
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for deployment scripts
	expectedScripts := []string{
		"scripts/deploy-docker.sh",
		"scripts/deploy-k8s.sh",
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

func TestSelfHostedDeployment_GenerateCICDGitHub(t *testing.T) {
	deploy := NewSelfHostedDeployment()
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
		Platform:     "self-hosted",
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
	assert.Contains(t, workflowContent, "name: Deploy to Self-Hosted")
	assert.Contains(t, workflowContent, "docker build")
	assert.Contains(t, workflowContent, "kubectl")
}

func TestSelfHostedDeployment_GenerateCICDGitLab(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "gitlab-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform:     "self-hosted",
		Runtime:      "nodejs20",
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
	assert.Contains(t, pipelineContent, "build")
	assert.Contains(t, pipelineContent, "deploy")
}

func TestSelfHostedDeployment_GenerateMonitoring(t *testing.T) {
	deploy := NewSelfHostedDeployment()
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
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for monitoring files
	fileMap := make(map[string]bool)
	for _, file := range pkg.Files {
		fileMap[file.Path] = true
	}

	assert.True(t, fileMap["monitoring/prometheus.yml"])
	assert.True(t, fileMap["monitoring/grafana/dashboards/dashboard.json"])
	assert.True(t, pkg.Metadata.HasMonitoring)
}

func TestSelfHostedDeployment_WithAuth(t *testing.T) {
	deploy := NewSelfHostedDeployment()
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
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check for secret manifest
	var secretContent string
	for _, file := range pkg.Files {
		if file.Path == "k8s/secret.yaml" {
			secretContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, secretContent)
	assert.Contains(t, secretContent, "kind: Secret")
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "API_KEY")
}

func TestSelfHostedDeployment_Statistics(t *testing.T) {
	deploy := NewSelfHostedDeployment()
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
		Platform: "self-hosted",
		Runtime:  "nodejs20",
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

func TestSelfHostedDeployment_EstimateCost(t *testing.T) {
	deploy := NewSelfHostedDeployment()

	ir := &parser.IntermediateRepresentation{
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
	}

	opts := DeploymentOptions{
		Runtime: "nodejs20",
	}

	cost := deploy.estimateMonthlyCost(ir, opts)

	assert.Greater(t, cost, 0.0)
	assert.Less(t, cost, 100.0) // Sanity check
}

func TestSelfHostedDeployment_PythonRuntime(t *testing.T) {
	deploy := NewSelfHostedDeployment()
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
		Platform: "self-hosted",
		Runtime:  "python311",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find Dockerfile
	var dockerfileContent string
	for _, file := range pkg.Files {
		if file.Path == "Dockerfile" {
			dockerfileContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, dockerfileContent)
	assert.Contains(t, dockerfileContent, "FROM python:3.11-slim")

	// Check for requirements.txt
	var requirementsContent string
	for _, file := range pkg.Files {
		if file.Path == "requirements.txt" {
			requirementsContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, requirementsContent)
	assert.Contains(t, requirementsContent, "flask")
}

func TestSelfHostedDeployment_GoRuntime(t *testing.T) {
	deploy := NewSelfHostedDeployment()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "go-test",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{Path: "/test", Method: "GET"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	opts := DeploymentOptions{
		Platform: "self-hosted",
		Runtime:  "go",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Find Dockerfile
	var dockerfileContent string
	for _, file := range pkg.Files {
		if file.Path == "Dockerfile" {
			dockerfileContent = file.Content
			break
		}
	}

	assert.NotEmpty(t, dockerfileContent)
	assert.Contains(t, dockerfileContent, "FROM golang:1.21-alpine")
	assert.Contains(t, dockerfileContent, "go build")
}

func TestSelfHostedDeployment_FileTypes(t *testing.T) {
	deploy := NewSelfHostedDeployment()
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
		Platform: "self-hosted",
		Runtime:  "nodejs20",
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

func TestSelfHostedDeployment_OAuth2Auth(t *testing.T) {
	deploy := NewSelfHostedDeployment()
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
		Platform: "self-hosted",
		Runtime:  "nodejs20",
	}

	pkg, err := deploy.Generate(ctx, ir, opts)

	require.NoError(t, err)

	// Check required secrets
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "CLIENT_ID")
	assert.Contains(t, pkg.Statistics.RequiredSecrets, "CLIENT_SECRET")
}
