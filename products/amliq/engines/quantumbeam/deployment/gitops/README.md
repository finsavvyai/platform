# GitOps Configuration Management

This directory contains the complete GitOps configuration management system for QuantumBeam, implementing automated deployment, configuration validation, and drift detection using ArgoCD.

## Architecture Overview

The GitOps system consists of:

1. **ArgoCD Controller** - Main GitOps controller for automated deployment
2. **Configuration Validator** - Automated configuration validation and testing
3. **Multi-Environment Management** - Staging, development, and production environments
4. **Application Sets** - Template-based application management
5. **Monitoring Integration** - Comprehensive monitoring and alerting
6. **Security Controls** - RBAC, policies, and compliance enforcement

## Components

### ArgoCD Configuration (`argocd-config.yaml`)

Complete ArgoCD installation and configuration:

**Features:**
- High availability deployment with Redis clustering
- OIDC authentication integration
- RBAC configuration with role-based access control
- Multi-repository support
- Automated sync policies with retry logic
- Notification system with Slack and email integration
- Prometheus metrics integration
- Application Sets for environment management

**Key Configurations:**
- **Projects**: Organized by application and environment
- **Applications**: Automated deployment for each service and environment
- **RBAC**: Granular permissions for developers, ops, and readonly users
- **Notifications**: Real-time alerts for deployment status
- **Security**: Network policies, secret management, audit logging

### ArgoCD Applications (`argocd-application.yaml`)

Pre-configured applications for GitOps:

**Applications:**
- **quantumbeam**: Main production application
- **quantumbeam-monitoring**: Monitoring stack (Prometheus, Grafana)
- **quantumbeam-bluegreen**: Blue-green deployment infrastructure
- **quantumbeam-infrastructure**: Infrastructure as Code
- **quantumbeam-secrets**: Secrets management
- **quantumbeam-staging**: Staging environment
- **quantumbeam-development**: Development environment

**Features:**
- Automated sync with self-healing
- Environment-specific configurations
- Prune and sync policies
- Health check validation
- Rollback capabilities

### Configuration Validator (`config-validator.py`)

Comprehensive validation system for Kubernetes configurations:

**Validation Categories:**
- **Basic Structure**: API version, kind, metadata validation
- **Labels and Annotations**: Required labels and annotation checks
- **Namespace Validation**: Namespace naming and pattern validation
- **Resource-Specific**: Deployment, Service, ConfigMap validation
- **Security Policies**: Security context, privilege checks
- **Image Policies**: Registry validation, tag requirements
- **Resource Limits**: CPU and memory requirements
- **Network Policies**: Network security validation
- **Kubernetes API**: API version and resource validation

**Features:**
- Repository-wide validation
- Real-time validation API
- Custom validation rules
- Prometheus metrics
- Notification integration
- Detailed reporting

## Installation and Setup

### Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured
- Helm 3.0+
- Git repositories for application manifests

### Installation Steps

1. **Install ArgoCD:**
```bash
# Apply ArgoCD configuration
kubectl apply -f argocd-config.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s
```

2. **Install ArgoCD Applications:**
```bash
# Apply application configurations
kubectl apply -f argocd-application.yaml

# Check application status
kubectl get applications -n argocd
```

3. **Install Configuration Validator:**
```bash
# Build and deploy validator
docker build -t quantumbeam/config-validator:latest -f Dockerfile.validator .
kubectl apply -f config-validator-deployment.yaml
```

4. **Configure Access:**
```bash
# Get ArgoCD admin password
kubectl get secret argocd-secret -n argocd -o jsonpath='{.data.admin.password}' | base64 -d

# Port forward to access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### Repository Setup

1. **Create Application Repository:**
```bash
git clone https://github.com/quantumbeam/quantumbeam-k8s
cd quantumbeam-k8s

# Create directory structure
mkdir -p manifests/{production,staging,development}
mkdir -p environments/{production,staging,development}
```

2. **Add Application Manifests:**
```yaml
# manifests/production/quantumbeam-api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: quantumbeam-api
  namespace: production
  labels:
    app: quantumbeam-api
    version: v1.0.0
    managed-by: argocd
spec:
  replicas: 3
  selector:
    matchLabels:
      app: quantumbeam-api
  template:
    metadata:
      labels:
        app: quantumbeam-api
        version: v1.0.0
    spec:
      containers:
      - name: api
        image: quantumbeam/api:v1.0.0
        ports:
        - containerPort: 8080
```

3. **Set up Git Repository:**
```bash
# Add ArgoCD repository
argocd repo add https://github.com/quantumbeam/quantumbeam-k8s

# Create application
argocd app create quantumbeam \
  --repo https://github.com/quantumbeam/quantumbeam-k8s \
  --path manifests/production \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace production \
  --sync-policy automated
```

## Configuration

### ArgoCD Configuration

#### Main Configuration (`argocd-cm`)

Key configuration options:

```yaml
# URL configuration
url: https://argocd.quantumbeam.io

# Repository configuration
repositories: |
  - type: git
    url: https://github.com/quantumbeam/quantumbeam-k8s
    name: quantumbeam-k8s

# OIDC configuration
oidc.config: |
  name: QuantumBeam OIDC
  issuer: https://your-oidc-provider.com
  clientID: argocd
  clientSecret: $oidc.clientSecret
```

#### RBAC Configuration (`argocd-rbac-cm`)

Role-based access control:

```yaml
# Developer policies
p, role:developer, applications, *, quantumbeam/*, allow
p, role:developer, applications, sync, quantumbeam/*, allow

# Group mappings
g, quantumbeam:developers, role:developer
g, quantumbeam:ops, role:ops
```

#### Notification Configuration

Slack and email notifications:

```yaml
notifications.argocd.cfg: |
  triggers:
    - name: on-sync-succeeded
      condition: ApplicationStatus && ApplicationStatus.health.status == 'Healthy'
      template: app-sync-succeeded
```

### Application Configuration

#### ApplicationSet Configuration

Template-based application management:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: quantumbeam-env-apps
spec:
  generators:
  - git:
      repoURL: https://github.com/quantumbeam/quantumbeam-k8s
      directories:
      - path: environments/*
  template:
    metadata:
      name: 'quantumbeam-{{path.basename}}'
    spec:
      source:
        repoURL: https://github.com/quantumbeam/quantumbeam-k8s
        path: 'environments/{{path.basename}}'
      destination:
        namespace: '{{path.basename}}'
```

#### Sync Policy Configuration

Automated sync with self-healing:

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  syncOptions:
  - CreateNamespace=true
  - PrunePropagationPolicy=foreground
  retry:
    limit: 5
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m
```

### Validator Configuration

#### Validation Rules

Custom validation rules configuration:

```yaml
validation_rules:
  required_labels:
    - app
    - version
    - managed-by
  required_annotations:
    - argocd.argoproj.io/sync-options
  security_policies:
    require_security_context: true
    forbid_privileged: true
    require_non_root_user: true
  image_policies:
    forbid_latest_tag: true
    allowed_registries:
      - quantumbeam.io
      - ghcr.io
```

## Usage

### Manual Operations

#### Sync Applications

```bash
# Sync all applications
argocd app sync --all

# Sync specific application
argocd app sync quantumbeam

# Sync with specific revision
argocd app sync quantumbeam --revision v1.2.0
```

#### Rollback Applications

```bash
# Rollback to previous revision
argocd app sync quantumbeam --revision HEAD~1

# Check sync history
argocd app history quantumbeam

# Manual rollback
argocd app rollback quantumbeam <revision>
```

#### Application Management

```bash
# List applications
argocd app list

# Get application details
argocd app get quantumbeam

# Check application status
argocd app wait quantumbeam --health

# Delete application
argocd app delete quantumbeam
```

### Configuration Validation

#### Validate Repository

```bash
# Validate entire repository
curl -X POST http://config-validator:8080/validate \
  -H "Content-Type: application/json" \
  -d '{
    "repository_url": "https://github.com/quantumbeam/quantumbeam-k8s",
    "branch": "main"
  }'
```

#### Validate Specific Commit

```bash
curl -X POST http://config-validator:8080/validate \
  -H "Content-Type: application/json" \
  -d '{
    "repository_url": "https://github.com/quantumbeam/quantumbeam-k8s",
    "commit_hash": "abc123def456",
    "branch": "main"
  }'
```

#### Get Validation Rules

```bash
curl http://config-validator:8080/rules
```

#### Update Validation Rules

```bash
curl -X POST http://config-validator:8080/rules \
  -H "Content-Type: application/json" \
  -d '{
    "required_labels": ["app", "version", "team", "environment"],
    "security_policies": {
      "require_security_context": true,
      "forbid_privileged": true
    }
  }'
```

### CI/CD Integration

#### GitHub Actions Integration

```yaml
# .github/workflows/gitops-sync.yml
name: GitOps Sync

on:
  push:
    branches: [main, develop]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Validate Configuration
      run: |
        curl -X POST http://config-validator:8080/validate \
          -H "Content-Type: application/json" \
          -d '{
            "repository_url": "https://github.com/quantumbeam/quantumbeam-k8s",
            "branch": "${{ github.ref_name }}"
          }'

    - name: Sync ArgoCD
      run: |
        argocd app sync quantumbeam-${{ github.ref_name }}
```

#### Git Hooks

Pre-commit hook for configuration validation:

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Validate changed files
changed_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(yaml|yml)$')

for file in $changed_files; do
  if [[ $file == k8s/** ]]; then
    echo "Validating $file..."
    kubectl apply --dry-run=client -f $file
  fi
done
```

## Monitoring and Observability

### ArgoCD Metrics

Prometheus metrics integration:

- **Application Health**: `argocd_app_health_status`
- **Sync Status**: `argocd_app_sync_status`
- **Sync Duration**: `argocd_app_sync_duration_seconds`
- **Repository Status**: `argocd_repo_status`

### Grafana Dashboards

Pre-built dashboards:

- **ArgoCD Overview**: Application health and sync status
- **Repository Status**: Repository connectivity and sync status
- **Performance Metrics**: Sync duration and operation metrics

### Logging

Structured logging with correlation IDs:

- Application deployment events
- Sync operation details
- Error and warning messages
- Performance metrics

## Security

### Authentication and Authorization

#### OIDC Integration

```yaml
oidc.config: |
  name: QuantumBeam OIDC
  issuer: https://your-oidc-provider.com
  clientID: argocd
  clientSecret: $oidc.clientSecret
  requestedScopes: ["openid", "profile", "email", "groups"]
```

#### RBAC Configuration

```yaml
policy.csv: |
  # Developer access
  p, role:developer, applications, sync, quantumbeam/*, allow

  # Ops access
  p, role:ops, applications, *, quantumbeam/*, allow

  # Group mappings
  g, quantumbeam:developers, role:developer
  g, quantumbeam:ops, role:ops
```

### Secret Management

#### Encrypted Secrets

Using Sealed Secrets or AWS Secrets Manager:

```yaml
# Using Sealed Secrets
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: quantumbeam-secrets
spec:
  encryptedData:
    database-password: AgBy3i4OJSWK+PiTySYZZA9rO43cGDEQAx...
```

#### External Secrets

Integration with external secret providers:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.quantumbeam.io"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "argocd-secret-reader"
```

### Network Policies

Restricting network access:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: argocd-network-policy
  namespace: argocd
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: argocd-server
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: argocd
    ports:
    - protocol: TCP
      port: 8080
```

## Troubleshooting

### Common Issues

#### Application Sync Failures

```bash
# Check application status
argocd app get quantumbeam

# Check sync status
argocd app sync quantumbeam --dry-run

# Check application logs
argocd app logs quantumbeam

# Check repository connectivity
argocd repo list
```

#### Permission Issues

```bash
# Check RBAC permissions
argocd account list
argocd account get-user-info <username>

# Check service account permissions
kubectl describe rolebinding argocd-redis -n argocd
```

#### Repository Access Issues

```bash
# Test repository connectivity
argocd repo list
argocd repo sync <repo-url>

# Check SSH keys
kubectl get secret argocd-repo-<repo-name>-<repo-type> -n argocd -o yaml
```

### Debug Commands

#### ArgoCD Controller Logs

```bash
# Application controller logs
kubectl logs -n argocd deployment/argocd-application-controller -f

# Server logs
kubectl logs -n argocd deployment/argocd-server -f

# Repo server logs
kubectl logs -n argocd deployment/argocd-repo-server -f
```

#### Configuration Validator Logs

```bash
# Validator logs
kubectl logs -n gitops deployment/config-validator -f

# Check validator metrics
curl http://config-validator:8081/metrics
```

#### Resource Status

```bash
# Check managed resources
kubectl get applications -n argocd
kubectl get appprojects -n argocd

# Check application resources
argocd app resources quantumbeam

# Check application tree
argocd app tree quantumbeam
```

## Best Practices

### Repository Organization

1. **Separate Repositories**: Separate repos for applications, infrastructure, and secrets
2. **Environment Branching**: Use separate branches for different environments
3. **Version Tagging**: Use semantic versioning for application tags
4. **Documentation**: Include README files and documentation in repos

### Application Structure

1. **Kustomize**: Use Kustomize for environment-specific configurations
2. **Helm Charts**: Use Helm charts for complex applications
3. **Labels**: Use consistent labeling across all resources
4. **Annotations**: Include relevant annotations for GitOps

### Security Practices

1. **Least Privilege**: Apply least privilege principle to RBAC
2. **Secret Management**: Use external secret management
3. **Network Policies**: Implement network policies
4. **Audit Logging**: Enable audit logging for all operations

### Monitoring Practices

1. **Metrics**: Collect comprehensive metrics
2. **Alerting**: Set up appropriate alerts
3. **Dashboards**: Create informative dashboards
4. **Health Checks**: Implement proper health checks

## Contributing

### Adding New Applications

1. Create application manifest in appropriate repository
2. Add ArgoCD application configuration
3. Configure appropriate RBAC permissions
4. Set up monitoring and alerting
5. Update documentation

### Extending Validation Rules

1. Add new validation rules to configuration
2. Update validator code with new checks
3. Add corresponding metrics
4. Update documentation
5. Test with sample configurations

### Improving GitOps Workflow

1. Analyze current workflow bottlenecks
2. Implement automation where possible
3. Add new features to validator
4. Improve monitoring and alerting
5. Update best practices documentation

## License

This GitOps configuration management system is part of the QuantumBeam platform and follows the same licensing terms.