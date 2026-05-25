package deployment

import (
	"context"
	"fmt"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// SelfHostedDeployment implements self-hosted deployment with Docker and Kubernetes
type SelfHostedDeployment struct {
	BaseDeployment
}

// NewSelfHostedDeployment creates a new self-hosted deployment provider
func NewSelfHostedDeployment() *SelfHostedDeployment {
	return &SelfHostedDeployment{
		BaseDeployment: BaseDeployment{
			name:    "self-hosted",
			version: "1.0.0",
			features: []DeploymentFeature{
				DeploymentFeatureSelfHosted,
				DeploymentFeatureCICD,
				DeploymentFeatureMonitoring,
				DeploymentFeatureAutoScaling,
				DeploymentFeatureSecretsManager,
			},
		},
	}
}

// Generate generates self-hosted deployment configuration
func (d *SelfHostedDeployment) Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts DeploymentOptions) (*DeploymentPackage, error) {
	startTime := time.Now()

	// Validate options
	if err := d.ValidateOptions(opts); err != nil {
		return nil, fmt.Errorf("invalid options: %w", err)
	}

	pkg := &DeploymentPackage{
		Platform:  "self-hosted",
		CreatedAt: time.Now(),
		Files:     []DeploymentFile{},
		Metadata: DeploymentMetadata{
			Platform:       "self-hosted",
			Runtime:        opts.Runtime,
			MemorySize:     opts.MemorySize,
			Timeout:        opts.Timeout,
			HasMonitoring:  true,
			HasAutoScaling: opts.EnableAutoScaling,
		},
	}

	// Generate Dockerfile
	dockerfileContent, err := d.generateDockerfile(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate Dockerfile: %w", err)
	}
	pkg.Files = append(pkg.Files, DeploymentFile{
		Path:     "Dockerfile",
		Content:  dockerfileContent,
		FileType: FileTypeConfig,
	})

	// Generate docker-compose.yml
	composeContent, err := d.generateDockerCompose(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate docker-compose: %w", err)
	}
	pkg.Files = append(pkg.Files, DeploymentFile{
		Path:     "docker-compose.yml",
		Content:  composeContent,
		FileType: FileTypeConfig,
	})

	// Generate Kubernetes manifests
	k8sFiles, err := d.generateKubernetesManifests(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate Kubernetes manifests: %w", err)
	}
	pkg.Files = append(pkg.Files, k8sFiles...)

	// Generate Helm chart if requested
	if opts.IncludeExamples {
		helmFiles, err := d.generateHelmChart(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate Helm chart: %w", err)
		}
		pkg.Files = append(pkg.Files, helmFiles...)
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

	// Generate application code
	appFiles, err := d.generateApplicationCode(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate application code: %w", err)
	}
	pkg.Files = append(pkg.Files, appFiles...)

	// Calculate statistics
	pkg.Statistics = d.calculateStatistics(pkg, ir, opts, time.Since(startTime))

	return pkg, nil
}

// Deploy performs the actual deployment
func (d *SelfHostedDeployment) Deploy(ctx context.Context, pkg *DeploymentPackage, opts DeploymentOptions) (*DeploymentResult, error) {
	return &DeploymentResult{
		Success:      false,
		DeploymentID: "",
		Endpoint:     "",
		Errors:       []string{"deployment not yet implemented - use generated scripts"},
	}, nil
}

// generateDockerfile generates Dockerfile for the application
func (d *SelfHostedDeployment) generateDockerfile(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	var dockerfile string

	if d.isNodeRuntime(opts.Runtime) {
		dockerfile = d.generateNodeDockerfile(ir, opts)
	} else if d.isPythonRuntime(opts.Runtime) {
		dockerfile = d.generatePythonDockerfile(ir, opts)
	} else if d.isGoRuntime(opts.Runtime) {
		dockerfile = d.generateGoDockerfile(ir, opts)
	} else {
		// Default to Node.js
		dockerfile = d.generateNodeDockerfile(ir, opts)
	}

	return dockerfile, nil
}

// generateNodeDockerfile generates Dockerfile for Node.js runtime
func (d *SelfHostedDeployment) generateNodeDockerfile(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir

	return fmt.Sprintf(`# Multi-stage build for Node.js MCP connector
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build if needed
RUN if [ -f "tsconfig.json" ]; then npm run build; fi

# Production image
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies and built app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE %d

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:%d/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["node", "dist/index.js"]
`, 8080, 8080)
}

// generatePythonDockerfile generates Dockerfile for Python runtime
func (d *SelfHostedDeployment) generatePythonDockerfile(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir

	return `# Multi-stage build for Python MCP connector
FROM python:3.11-slim AS builder

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production image
FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1001 python

# Copy dependencies
COPY --from=builder --chown=python:python /root/.local /home/python/.local
COPY --chown=python:python . .

# Add user site-packages to PATH
ENV PATH=/home/python/.local/bin:$PATH

# Switch to non-root user
USER python

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health').read()"

# Start application
CMD ["python", "app.py"]
`
}

// generateGoDockerfile generates Dockerfile for Go runtime
func (d *SelfHostedDeployment) generateGoDockerfile(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = d.sanitizeResourceName(ir.Metadata.Name)

	return `# Multi-stage build for Go MCP connector
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Production image
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/main .

# Create non-root user
RUN adduser -D -u 1001 app
USER app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start application
CMD ["./main"]
`
}

// generateDockerCompose generates docker-compose.yml
func (d *SelfHostedDeployment) generateDockerCompose(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	appName := d.sanitizeResourceName(ir.Metadata.Name)
	hasAuth := len(ir.Auth) > 0

	compose := fmt.Sprintf(`version: '3.8'

services:
  %s:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: %s
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
`, appName, appName)

	// Add auth environment variables if needed
	if hasAuth {
		compose += `      - API_KEY=${API_KEY}
      - CLIENT_ID=${CLIENT_ID}
      - CLIENT_SECRET=${CLIENT_SECRET}
`
	}

	compose += `    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    networks:
      - mcp-network
`

	// Add Prometheus for monitoring
	compose += `
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped
    networks:
      - mcp-network

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    restart: unless-stopped
    networks:
      - mcp-network
    depends_on:
      - prometheus

networks:
  mcp-network:
    driver: bridge

volumes:
  prometheus-data:
  grafana-data:
`

	return compose, nil
}

// generateKubernetesManifests generates Kubernetes YAML manifests
func (d *SelfHostedDeployment) generateKubernetesManifests(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate namespace
	namespace := d.generateK8sNamespace(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "k8s/namespace.yaml",
		Content:  namespace,
		FileType: FileTypeConfig,
	})

	// Generate deployment
	deployment := d.generateK8sDeployment(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "k8s/deployment.yaml",
		Content:  deployment,
		FileType: FileTypeConfig,
	})

	// Generate service
	service := d.generateK8sService(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "k8s/service.yaml",
		Content:  service,
		FileType: FileTypeConfig,
	})

	// Generate ingress
	ingress := d.generateK8sIngress(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "k8s/ingress.yaml",
		Content:  ingress,
		FileType: FileTypeConfig,
	})

	// Generate configmap
	configmap := d.generateK8sConfigMap(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "k8s/configmap.yaml",
		Content:  configmap,
		FileType: FileTypeConfig,
	})

	// Generate secret
	if len(ir.Auth) > 0 {
		secret := d.generateK8sSecret(ir, opts)
		files = append(files, DeploymentFile{
			Path:     "k8s/secret.yaml",
			Content:  secret,
			FileType: FileTypeConfig,
		})
	}

	// Generate HPA if auto-scaling is enabled
	if opts.EnableAutoScaling {
		hpa := d.generateK8sHPA(ir, opts)
		files = append(files, DeploymentFile{
			Path:     "k8s/hpa.yaml",
			Content:  hpa,
			FileType: FileTypeConfig,
		})
	}

	return files, nil
}

// generateK8sNamespace generates Kubernetes namespace
func (d *SelfHostedDeployment) generateK8sNamespace(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`apiVersion: v1
kind: Namespace
metadata:
  name: %s
  labels:
    app: %s
    environment: production
`, appName, appName)
}

// generateK8sDeployment generates Kubernetes deployment
func (d *SelfHostedDeployment) generateK8sDeployment(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)
	hasAuth := len(ir.Auth) > 0

	deployment := fmt.Sprintf(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: %s
  namespace: %s
  labels:
    app: %s
spec:
  replicas: 2
  selector:
    matchLabels:
      app: %s
  template:
    metadata:
      labels:
        app: %s
    spec:
      containers:
      - name: %s
        image: %s:latest
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: PORT
          value: "8080"
        - name: NODE_ENV
          value: "production"
`, appName, appName, appName, appName, appName, appName, appName)

	// Add auth environment variables from secret
	if hasAuth {
		deployment += `        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: ` + appName + `-secret
              key: api-key
        - name: CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: ` + appName + `-secret
              key: client-id
        - name: CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: ` + appName + `-secret
              key: client-secret
`
	}

	deployment += `        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
`

	return deployment
}

// generateK8sService generates Kubernetes service
func (d *SelfHostedDeployment) generateK8sService(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`apiVersion: v1
kind: Service
metadata:
  name: %s
  namespace: %s
  labels:
    app: %s
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: %s
`, appName, appName, appName, appName)
}

// generateK8sIngress generates Kubernetes ingress
func (d *SelfHostedDeployment) generateK8sIngress(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: %s
  namespace: %s
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - %s.example.com
    secretName: %s-tls
  rules:
  - host: %s.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: %s
            port:
              number: 80
`, appName, appName, appName, appName, appName, appName)
}

// generateK8sConfigMap generates Kubernetes configmap
func (d *SelfHostedDeployment) generateK8sConfigMap(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`apiVersion: v1
kind: ConfigMap
metadata:
  name: %s-config
  namespace: %s
data:
  PORT: "8080"
  NODE_ENV: "production"
  LOG_LEVEL: "info"
`, appName, appName)
}

// generateK8sSecret generates Kubernetes secret template
func (d *SelfHostedDeployment) generateK8sSecret(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`apiVersion: v1
kind: Secret
metadata:
  name: %s-secret
  namespace: %s
type: Opaque
stringData:
  api-key: "YOUR_API_KEY_HERE"
  client-id: "YOUR_CLIENT_ID_HERE"
  client-secret: "YOUR_CLIENT_SECRET_HERE"
`, appName, appName)
}

// generateK8sHPA generates Kubernetes Horizontal Pod Autoscaler
func (d *SelfHostedDeployment) generateK8sHPA(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: %s-hpa
  namespace: %s
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: %s
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
`, appName, appName, appName)
}

// generateHelmChart generates Helm chart files
func (d *SelfHostedDeployment) generateHelmChart(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate Chart.yaml
	chartYaml := d.generateHelmChartYaml(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "helm/Chart.yaml",
		Content:  chartYaml,
		FileType: FileTypeConfig,
	})

	// Generate values.yaml
	valuesYaml := d.generateHelmValues(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "helm/values.yaml",
		Content:  valuesYaml,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// generateHelmChartYaml generates Helm Chart.yaml
func (d *SelfHostedDeployment) generateHelmChartYaml(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`apiVersion: v2
name: %s
description: %s
type: application
version: 1.0.0
appVersion: "1.0.0"
`, appName, ir.Metadata.Description)
}

// generateHelmValues generates Helm values.yaml
func (d *SelfHostedDeployment) generateHelmValues(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`replicaCount: 2

image:
  repository: %s
  pullPolicy: IfNotPresent
  tag: "latest"

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: %s.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: %s-tls
      hosts:
        - %s.example.com

resources:
  limits:
    cpu: 500m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: %t
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
`, appName, appName, appName, appName, opts.EnableAutoScaling)
}

// generateDeploymentScripts generates deployment automation scripts
func (d *SelfHostedDeployment) generateDeploymentScripts(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate Docker deployment script
	dockerScript := d.generateDockerDeployScript(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "scripts/deploy-docker.sh",
		Content:  dockerScript,
		FileType: FileTypeScript,
	})

	// Generate Kubernetes deployment script
	k8sScript := d.generateK8sDeployScript(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "scripts/deploy-k8s.sh",
		Content:  k8sScript,
		FileType: FileTypeScript,
	})

	// Generate cleanup script
	cleanupScript := d.generateCleanupScript(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "scripts/cleanup.sh",
		Content:  cleanupScript,
		FileType: FileTypeScript,
	})

	return files, nil
}

// generateDockerDeployScript generates Docker deployment script
func (d *SelfHostedDeployment) generateDockerDeployScript(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`#!/bin/bash
set -e

# Docker Deployment Script for %s
# Generated by MCPOverflow

echo "Building Docker image..."
docker build -t %s:latest .

echo "Starting containers with docker-compose..."
docker-compose up -d

echo "✅ Deployment complete!"
echo "Application: http://localhost:8080"
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3000"
`, ir.Metadata.Name, appName)
}

// generateK8sDeployScript generates Kubernetes deployment script
func (d *SelfHostedDeployment) generateK8sDeployScript(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`#!/bin/bash
set -e

# Kubernetes Deployment Script for %s
# Generated by MCPOverflow

NAMESPACE="%s"

echo "Creating namespace..."
kubectl apply -f k8s/namespace.yaml

echo "Applying ConfigMap..."
kubectl apply -f k8s/configmap.yaml

echo "Applying Secret..."
kubectl apply -f k8s/secret.yaml

echo "Deploying application..."
kubectl apply -f k8s/deployment.yaml

echo "Creating service..."
kubectl apply -f k8s/service.yaml

echo "Creating ingress..."
kubectl apply -f k8s/ingress.yaml

echo "Applying HPA..."
kubectl apply -f k8s/hpa.yaml

echo "Waiting for deployment to be ready..."
kubectl rollout status deployment/%s -n $NAMESPACE

echo "✅ Deployment complete!"
kubectl get pods -n $NAMESPACE
`, ir.Metadata.Name, appName, appName)
}

// generateCleanupScript generates cleanup script
func (d *SelfHostedDeployment) generateCleanupScript(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`#!/bin/bash
set -e

# Cleanup Script for %s
# Generated by MCPOverflow

echo "⚠️  This will delete all resources for: %s"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled"
    exit 0
fi

echo "Stopping Docker containers..."
docker-compose down -v

echo "Deleting Kubernetes resources..."
kubectl delete namespace %s --ignore-not-found

echo "✅ Cleanup complete"
`, ir.Metadata.Name, ir.Metadata.Name, appName)
}

// generateCICD generates CI/CD pipeline configuration
func (d *SelfHostedDeployment) generateCICD(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	switch opts.CICDProvider {
	case "github-actions":
		workflow := d.generateGitHubActionsWorkflow(ir, opts)
		files = append(files, DeploymentFile{
			Path:     ".github/workflows/deploy.yml",
			Content:  workflow,
			FileType: FileTypeConfig,
		})
	case "gitlab-ci":
		pipeline := d.generateGitLabCIPipeline(ir, opts)
		files = append(files, DeploymentFile{
			Path:     ".gitlab-ci.yml",
			Content:  pipeline,
			FileType: FileTypeConfig,
		})
	}

	return files, nil
}

// generateGitHubActionsWorkflow generates GitHub Actions workflow
func (d *SelfHostedDeployment) generateGitHubActionsWorkflow(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`name: Deploy to Self-Hosted

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  IMAGE_NAME: %s
  NAMESPACE: %s

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t ${{ env.IMAGE_NAME }}:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login -u "${{ secrets.REGISTRY_USERNAME }}" --password-stdin
          docker push ${{ env.IMAGE_NAME }}:${{ github.sha }}

  deploy:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v3

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Configure kubeconfig
        run: |
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > $HOME/.kube/config

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/%s %s=${{ env.IMAGE_NAME }}:${{ github.sha }} -n ${{ env.NAMESPACE }}
          kubectl rollout status deployment/%s -n ${{ env.NAMESPACE }}
`, appName, appName, appName, appName, appName)
}

// generateGitLabCIPipeline generates GitLab CI pipeline
func (d *SelfHostedDeployment) generateGitLabCIPipeline(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`stages:
  - build
  - deploy

variables:
  IMAGE_NAME: %s
  NAMESPACE: %s

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $IMAGE_NAME:$CI_COMMIT_SHA .
    - docker push $IMAGE_NAME:$CI_COMMIT_SHA
  only:
    - main

deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl set image deployment/%s %s=$IMAGE_NAME:$CI_COMMIT_SHA -n $NAMESPACE
    - kubectl rollout status deployment/%s -n $NAMESPACE
  only:
    - main
`, appName, appName, appName, appName, appName)
}

// generateMonitoring generates monitoring configuration
func (d *SelfHostedDeployment) generateMonitoring(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate Prometheus config
	prometheusConfig := d.generatePrometheusConfig(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "monitoring/prometheus.yml",
		Content:  prometheusConfig,
		FileType: FileTypeConfig,
	})

	// Generate Grafana dashboard
	grafanaDashboard := d.generateGrafanaDashboard(ir, opts)
	files = append(files, DeploymentFile{
		Path:     "monitoring/grafana/dashboards/dashboard.json",
		Content:  grafanaDashboard,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// generatePrometheusConfig generates Prometheus configuration
func (d *SelfHostedDeployment) generatePrometheusConfig(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	appName := d.sanitizeResourceName(ir.Metadata.Name)

	return fmt.Sprintf(`global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: '%s'
    static_configs:
      - targets: ['%s:8080']
`, appName, appName)
}

// generateGrafanaDashboard generates Grafana dashboard JSON
func (d *SelfHostedDeployment) generateGrafanaDashboard(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir
	_ = opts

	return `{
  "dashboard": {
    "title": "MCP Connector Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      }
    ]
  }
}
`
}

// generateApplicationCode generates application code template
func (d *SelfHostedDeployment) generateApplicationCode(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	if d.isNodeRuntime(opts.Runtime) {
		packageJSON := d.generateNodePackageJSON(ir, opts)
		files = append(files, DeploymentFile{
			Path:     "package.json",
			Content:  packageJSON,
			FileType: FileTypeConfig,
		})
	} else if d.isPythonRuntime(opts.Runtime) {
		requirements := d.generatePythonRequirements(ir, opts)
		files = append(files, DeploymentFile{
			Path:     "requirements.txt",
			Content:  requirements,
			FileType: FileTypeConfig,
		})
	}

	return files, nil
}

// generateNodePackageJSON generates package.json for Node.js
func (d *SelfHostedDeployment) generateNodePackageJSON(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	return fmt.Sprintf(`{
  "name": "%s",
  "version": "1.0.0",
  "description": "%s",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "typescript": "^5.0.0"
  }
}
`, ir.Metadata.Name, ir.Metadata.Description)
}

// generatePythonRequirements generates requirements.txt for Python
func (d *SelfHostedDeployment) generatePythonRequirements(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	_ = ir
	_ = opts

	return `flask==3.0.0
gunicorn==21.2.0
prometheus-client==0.19.0
`
}

// Helper methods

func (d *SelfHostedDeployment) isNodeRuntime(runtime string) bool {
	return runtime == "nodejs18" || runtime == "nodejs20" || runtime == "node" || runtime == ""
}

func (d *SelfHostedDeployment) isPythonRuntime(runtime string) bool {
	return runtime == "python39" || runtime == "python310" || runtime == "python311" || runtime == "python"
}

func (d *SelfHostedDeployment) isGoRuntime(runtime string) bool {
	return runtime == "go" || runtime == "go1.21"
}

func (d *SelfHostedDeployment) calculateStatistics(pkg *DeploymentPackage, ir *parser.IntermediateRepresentation, opts DeploymentOptions, duration time.Duration) DeploymentStatistics {
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

func (d *SelfHostedDeployment) estimateMonthlyCost(ir *parser.IntermediateRepresentation, opts DeploymentOptions) float64 {
	// Self-hosted cost depends on infrastructure
	// Assuming AWS EC2 t3.medium instance + EBS storage
	// ~$30-40/month for small workload
	return 35.00
}
