package deployment

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/models"
	"gorm.io/gorm"
)

// CloudflareService handles Cloudflare Workers deployment operations
type CloudflareService struct {
	config *config.Config
	db     *gorm.DB
	client *http.Client
}

// NewCloudflareService creates a new Cloudflare deployment service
func NewCloudflareService(cfg *config.Config, db *gorm.DB) *CloudflareService {
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
		},
	}

	return &CloudflareService{
		config: cfg,
		db:     db,
		client: client,
	}
}

// CloudflareAuth represents Cloudflare API authentication
type CloudflareAuth struct {
	APIToken string `json:"api_token"`
	Email    string `json:"email,omitempty"`
	APIKey   string `json:"api_key,omitempty"`
}

// CloudflareWorker represents a Cloudflare Worker configuration
type CloudflareWorker struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Script       string            `json:"script"`
	Bindings     map[string]string `json:"bindings"`
	EnvVars      map[string]string `json:"env_vars"`
	KVNamespaces []KVNamespace     `json:"kv_namespaces"`
}

// KVNamespace represents a KV namespace binding
type KVNamespace struct {
	ID        string `json:"id"`
	Binding   string `json:"binding"`
	PreviewID string `json:"preview_id,omitempty"`
}

// DeploymentRequest represents a deployment request
type DeploymentRequest struct {
	ConnectorID string                 `json:"connector_id"`
	Version     string                 `json:"version"`
	Environment string                 `json:"environment"`
	Config      CloudflareWorkerConfig `json:"config"`
}

// CloudflareWorkerConfig contains worker-specific configuration
type CloudflareWorkerConfig struct {
	Main         string            `json:"main"`
	CompatDate   string            `json:"compatibility_date"`
	CompatFlags  []string          `json:"compatibility_flags"`
	KVNamespaces []KVNamespace     `json:"kv_namespaces"`
	D1Databases  []D1Database      `json:"d1_databases"`
	R2Buckets    []R2Bucket        `json:"r2_buckets"`
	EnvVars      map[string]string `json:"vars"`
	Services     []ServiceBinding  `json:"services"`
}

// D1Database represents a D1 database binding
type D1Database struct {
	Binding      string `json:"binding"`
	DatabaseName string `json:"database_name"`
	DatabaseID   string `json:"database_id"`
}

// R2Bucket represents an R2 bucket binding
type R2Bucket struct {
	Binding    string `json:"binding"`
	BucketName string `json:"bucket_name"`
}

// ServiceBinding represents a service binding
type ServiceBinding struct {
	Binding string `json:"binding"`
	Service string `json:"service"`
}

// DeploymentResponse represents the response from a deployment operation
type DeploymentResponse struct {
	Success     bool      `json:"success"`
	WorkerID    string    `json:"worker_id"`
	WorkerURL   string    `json:"worker_url"`
	Version     string    `json:"version"`
	Environment string    `json:"environment"`
	Message     string    `json:"message"`
	Timestamp   time.Time `json:"timestamp"`
}

// DeployWorker deploys a generated MCP connector as a Cloudflare Worker
func (s *CloudflareService) DeployWorker(ctx context.Context, req *DeploymentRequest) (*DeploymentResponse, error) {
	// Get the connector
	var connector models.Connector
	if err := s.db.First(&connector, "id = ?", req.ConnectorID).Error; err != nil {
		return nil, fmt.Errorf("connector not found: %w", err)
	}

	// Validate the connector has generated code
	if connector.GeneratedCode == "" {
		return nil, fmt.Errorf("connector has no generated code to deploy")
	}

	// Create Cloudflare API client
	cfClient := s.createCloudflareClient()

	// Create or update the worker script
	workerScript, err := s.prepareWorkerScript(connector, req.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare worker script: %w", err)
	}

	// Deploy to Cloudflare
	workerID, workerURL, err := s.uploadWorkerScript(ctx, cfClient, connector.Name, workerScript, req.Environment)
	if err != nil {
		return nil, fmt.Errorf("failed to deploy worker: %w", err)
	}

	// Configure worker bindings and environment variables
	if err := s.configureWorkerBindings(ctx, cfClient, workerID, req.Config); err != nil {
		return nil, fmt.Errorf("failed to configure worker bindings: %w", err)
	}

	// Update connector deployment status
	connector.DeploymentInfo = &models.DeploymentInfo{
		Platform:    "cloudflare",
		URL:         workerURL,
		WorkerID:    workerID,
		Region:      "auto", // Default or from config
		Environment: map[string]string{"ENVIRONMENT": req.Environment},
	}
	connector.Status = models.ConnectorStatusActive
	connector.Runtime = models.ConnectorRuntimeWorkerTS
	now := time.Now()
	connector.DeployedAt = &now
	connector.LastDeployed = &now

	if err := s.db.Save(&connector).Error; err != nil {
		return nil, fmt.Errorf("failed to update connector status: %w", err)
	}

	// Parse connector ID for deployment record
	connectorUUID, err := uuid.Parse(req.ConnectorID)
	if err != nil {
		return nil, fmt.Errorf("invalid connector ID: %w", err)
	}

	// Create deployment record
	deployment := &models.Deployment{
		ConnectorID: connectorUUID,
		Version:     req.Version,
		Environment: req.Environment,
		Platform:    "cloudflare",
		Status:      "active",
		URL:         workerURL,
		DeployedAt:  &now,
	}

	if err := s.db.Create(deployment).Error; err != nil {
		return nil, fmt.Errorf("failed to create deployment record: %w", err)
	}

	return &DeploymentResponse{
		Success:     true,
		WorkerID:    workerID,
		WorkerURL:   workerURL,
		Version:     req.Version,
		Environment: req.Environment,
		Message:     "Worker deployed successfully",
		Timestamp:   time.Now(),
	}, nil
}

// UpdateWorker updates an existing Cloudflare Worker
func (s *CloudflareService) UpdateWorker(ctx context.Context, connectorID, version string, config CloudflareWorkerConfig) (*DeploymentResponse, error) {
	// Get the connector and current deployment info
	var connector models.Connector
	if err := s.db.First(&connector, "id = ?", connectorID).Error; err != nil {
		return nil, fmt.Errorf("connector not found: %w", err)
	}

	if connector.DeploymentInfo == nil {
		return nil, fmt.Errorf("connector deployment info is missing")
	}

	workerID := connector.DeploymentInfo.WorkerID
	environment := connector.DeploymentInfo.Environment["ENVIRONMENT"]
	if environment == "" {
		environment = "production" // Default fallback
	}

	// Prepare updated script
	workerScript, err := s.prepareWorkerScript(connector, config)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare worker script: %w", err)
	}

	// Update the worker
	cfClient := s.createCloudflareClient()
	workerURL, err := s.updateWorkerScript(ctx, cfClient, workerID, workerScript)
	if err != nil {
		return nil, fmt.Errorf("failed to update worker: %w", err)
	}

	// Update connector info
	now := time.Now()
	// Update relevant fields in DeploymentInfo if needed, e.g. URL if changed
	connector.DeploymentInfo.URL = workerURL
	connector.Version = version
	connector.LastDeployed = &now

	if err := s.db.Save(&connector).Error; err != nil {
		return nil, fmt.Errorf("failed to update connector: %w", err)
	}

	// Parse connector ID
	connectorUUID, err := uuid.Parse(connectorID)
	if err != nil {
		return nil, fmt.Errorf("invalid connector ID: %w", err)
	}

	// Create new deployment record
	deployment := &models.Deployment{
		ConnectorID: connectorUUID,
		Version:     version,
		Environment: environment,
		Platform:    "cloudflare",
		Status:      "active",
		URL:         workerURL,
		DeployedAt:  &now,
	}

	if err := s.db.Create(deployment).Error; err != nil {
		return nil, fmt.Errorf("failed to create deployment record: %w", err)
	}

	return &DeploymentResponse{
		Success:     true,
		WorkerID:    workerID,
		WorkerURL:   workerURL,
		Version:     version,
		Environment: environment,
		Message:     "Worker updated successfully",
		Timestamp:   time.Now(),
	}, nil
}

// DeleteWorker removes a Cloudflare Worker
func (s *CloudflareService) DeleteWorker(ctx context.Context, connectorID string) error {
	// Get the connector
	var connector models.Connector
	if err := s.db.First(&connector, "id = ?", connectorID).Error; err != nil {
		return fmt.Errorf("connector not found: %w", err)
	}

	if connector.DeploymentInfo == nil {
		return fmt.Errorf("connector is not deployed")
	}

	workerID := connector.DeploymentInfo.WorkerID

	// Delete from Cloudflare
	cfClient := s.createCloudflareClient()
	if err := s.deleteWorkerScript(ctx, cfClient, workerID); err != nil {
		return fmt.Errorf("failed to delete worker: %w", err)
	}

	// Update connector status
	connector.Status = models.ConnectorStatusPending // Was Draft, but Pending is defined constant
	connector.DeploymentInfo = nil

	if err := s.db.Save(&connector).Error; err != nil {
		return fmt.Errorf("failed to update connector status: %w", err)
	}

	return nil
}

// GetWorkerStatus retrieves the status of a deployed worker
func (s *CloudflareService) GetWorkerStatus(ctx context.Context, connectorID string) (*models.WorkerStatus, error) {
	var connector models.Connector
	if err := s.db.First(&connector, "id = ?", connectorID).Error; err != nil {
		return nil, fmt.Errorf("connector not found: %w", err)
	}

	if connector.DeploymentInfo == nil {
		return nil, fmt.Errorf("connector is not deployed")
	}

	workerID := connector.DeploymentInfo.WorkerID
	url := connector.DeploymentInfo.URL
	environment := connector.DeploymentInfo.Environment["ENVIRONMENT"]
	if environment == "" {
		environment = "production"
	}

	// Check worker health
	cfClient := s.createCloudflareClient()
	healthy, err := s.checkWorkerHealth(ctx, cfClient, workerID)
	if err != nil {
		return nil, fmt.Errorf("failed to check worker health: %w", err)
	}

	// Parse connector UUID
	connUUID, err := uuid.Parse(connectorID)
	if err != nil {
		return nil, fmt.Errorf("invalid connector ID: %w", err)
	}

	return &models.WorkerStatus{
		ConnectorID: connUUID,
		WorkerID:    workerID,
		URL:         url,
		Environment: environment,
		Status:      map[bool]string{true: "healthy", false: "unhealthy"}[healthy],
		LastChecked: time.Now(),
	}, nil
}

// createCloudflareClient creates an HTTP client for Cloudflare API
func (s *CloudflareService) createCloudflareClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
		},
	}
}

// prepareWorkerScript prepares the worker script for deployment
func (s *CloudflareService) prepareWorkerScript(connector models.Connector, config CloudflareWorkerConfig) (string, error) {
	// In a real implementation, this would:
	// 1. Take the generated Go code from connector.GeneratedCode
	// 2. Compile it to WASM using TinyGo
	// 3. Wrap it in a Cloudflare Worker JavaScript wrapper
	// 4. Include AgentKit integration if present

	// For now, return a basic worker script
	script := `
import { MCPWorker } from './mcp-worker.js';

export default {
	async fetch(request, env, ctx) {
		const worker = new MCPWorker(env);
		return await worker.handle(request);
	},
};
`

	return script, nil
}

// uploadWorkerScript uploads a worker script to Cloudflare
func (s *CloudflareService) uploadWorkerScript(ctx context.Context, client *http.Client, name, script, environment string) (string, string, error) {
	// Implementation would use Cloudflare API to upload worker
	// For now, return mock values
	workerID := fmt.Sprintf("worker_%d", time.Now().Unix())
	workerURL := fmt.Sprintf("https://%s.workers.dev", workerID)

	return workerID, workerURL, nil
}

// updateWorkerScript updates an existing worker script
func (s *CloudflareService) updateWorkerScript(ctx context.Context, client *http.Client, workerID, script string) (string, error) {
	// Implementation would use Cloudflare API to update worker
	// For now, return mock URL
	workerURL := fmt.Sprintf("https://%s.workers.dev", workerID)

	return workerURL, nil
}

// deleteWorkerScript deletes a worker from Cloudflare
func (s *CloudflareService) deleteWorkerScript(ctx context.Context, client *http.Client, workerID string) error {
	// Implementation would use Cloudflare API to delete worker
	return nil
}

// configureWorkerBindings configures worker bindings and environment variables
func (s *CloudflareService) configureWorkerBindings(ctx context.Context, client *http.Client, workerID string, config CloudflareWorkerConfig) error {
	// Implementation would configure KV namespaces, D1 databases, etc.
	return nil
}

// checkWorkerHealth checks if a worker is healthy
func (s *CloudflareService) checkWorkerHealth(ctx context.Context, client *http.Client, workerID string) (bool, error) {
	// Implementation would ping the worker's health endpoint
	// For now, return true
	return true, nil
}

// ListDeployments lists all deployments for a connector
func (s *CloudflareService) ListDeployments(ctx context.Context, connectorID string) ([]*models.Deployment, error) {
	var deployments []*models.Deployment
	if err := s.db.Where("connector_id = ?", connectorID).Order("deployed_at DESC").Find(&deployments).Error; err != nil {
		return nil, fmt.Errorf("failed to list deployments: %w", err)
	}

	return deployments, nil
}

// RollbackDeployment rolls back to a previous deployment version
func (s *CloudflareService) RollbackDeployment(ctx context.Context, connectorID, targetVersion string) (*DeploymentResponse, error) {
	// Get the target deployment
	var targetDeployment models.Deployment
	if err := s.db.Where("connector_id = ? AND version = ?", connectorID, targetVersion).First(&targetDeployment).Error; err != nil {
		return nil, fmt.Errorf("target deployment not found: %w", err)
	}

	// This would involve restoring the previous worker script
	// For now, return a mock response
	return &DeploymentResponse{
		Success:     true,
		WorkerID:    fmt.Sprintf("worker_rollback_%d", time.Now().Unix()),
		WorkerURL:   targetDeployment.URL,
		Version:     targetVersion,
		Environment: targetDeployment.Environment,
		Message:     "Rollback completed successfully",
		Timestamp:   time.Now(),
	}, nil
}
