package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/logging"
	"go.uber.org/zap"
)

// OpenHandsService manages communication with OpenHands AI engine
type OpenHandsService struct {
	cfg        *config.Config
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

// Job represents an async AI job
type Job struct {
	ID        string
	UserID    string
	Type      string
	Status    string
	Progress  int
	Result    interface{}
	Error     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// NewOpenHandsService creates a new OpenHands service instance
func NewOpenHandsService(cfg *config.Config) *OpenHandsService {
	return &OpenHandsService{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 5 * time.Minute, // AI operations can take a while
		},
		baseURL: getEnv("OPENHANDS_API_URL", "http://localhost:3001"),
		apiKey:  getEnv("OPENHANDS_API_KEY", ""),
	}
}

// CreateNLGenerationJob creates a natural language generation job
func (s *OpenHandsService) CreateNLGenerationJob(req NLGenerationRequest) (*Job, error) {
	job := &Job{
		ID:        uuid.New().String(),
		UserID:    req.UserID,
		Type:      "nl_generation",
		Status:    "pending",
		Progress:  0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Start async processing
	go s.processNLGeneration(job, req)

	return job, nil
}

// processNLGeneration processes natural language generation in background
func (s *OpenHandsService) processNLGeneration(job *Job, req NLGenerationRequest) {
	job.Status = "processing"
	job.Progress = 10
	job.UpdatedAt = time.Now()

	// Call OpenHands adapter
	payload := map[string]interface{}{
		"description": req.Description,
	}

	result, err := s.callOpenHands("/api/generate-from-description", payload)
	if err != nil {
		logging.Error("NL generation failed", zap.Error(err), zap.String("jobId", job.ID))
		job.Status = "failed"
		job.Error = err.Error()
		job.UpdatedAt = time.Now()
		return
	}

	job.Status = "completed"
	job.Progress = 100
	job.Result = result
	job.UpdatedAt = time.Now()

	logging.Info("NL generation completed", zap.String("jobId", job.ID))
}

// AnalyzeAPI analyzes an API specification using OpenHands
func (s *OpenHandsService) AnalyzeAPI(req APIAnalysisRequest) (*APIAnalysisResponse, error) {
	payload := map[string]interface{}{
		"specType": req.SpecType,
		"spec":     req.Spec,
	}

	result, err := s.callOpenHands("/api/analyze", payload)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze API: %w", err)
	}

	// Parse result into APIAnalysisResponse
	var analysis APIAnalysisResponse
	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %w", err)
	}

	if err := json.Unmarshal(resultBytes, &analysis); err != nil {
		return nil, fmt.Errorf("failed to parse analysis result: %w", err)
	}

	return &analysis, nil
}

// CreateConnectorGenerationJob creates a connector generation job
func (s *OpenHandsService) CreateConnectorGenerationJob(userID string, req ConnectorGenerationRequest) (*Job, error) {
	job := &Job{
		ID:        uuid.New().String(),
		UserID:    userID,
		Type:      "connector_generation",
		Status:    "pending",
		Progress:  0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Start async processing
	go s.processConnectorGeneration(job, req)

	return job, nil
}

// processConnectorGeneration processes connector generation in background
func (s *OpenHandsService) processConnectorGeneration(job *Job, req ConnectorGenerationRequest) {
	job.Status = "processing"
	job.Progress = 10
	job.UpdatedAt = time.Now()

	// Call OpenHands adapter
	payload := map[string]interface{}{
		"name":              req.Name,
		"specType":          req.SpecType,
		"spec":              req.Spec,
		"language":          req.Language,
		"runtime":           req.Runtime,
		"authConfig":        req.AuthConfig,
		"selectedEndpoints": req.SelectedEndpoints,
		"customizations":    req.Customizations,
	}

	result, err := s.callOpenHands("/api/generate-connector", payload)
	if err != nil {
		logging.Error("Connector generation failed", zap.Error(err), zap.String("jobId", job.ID))
		job.Status = "failed"
		job.Error = err.Error()
		job.UpdatedAt = time.Now()
		return
	}

	job.Status = "completed"
	job.Progress = 100
	job.Result = result
	job.UpdatedAt = time.Now()

	logging.Info("Connector generation completed", zap.String("jobId", job.ID))
}

// CreateTestGenerationJob creates a test generation job
func (s *OpenHandsService) CreateTestGenerationJob(userID string, req TestGenerationRequest) (*Job, error) {
	job := &Job{
		ID:        uuid.New().String(),
		UserID:    userID,
		Type:      "test_generation",
		Status:    "pending",
		Progress:  0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Start async processing
	go s.processTestGeneration(job, req)

	return job, nil
}

// processTestGeneration processes test generation in background
func (s *OpenHandsService) processTestGeneration(job *Job, req TestGenerationRequest) {
	job.Status = "processing"
	job.Progress = 10
	job.UpdatedAt = time.Now()

	// TODO: Fetch connector from database
	// For now, assume we have connector code

	payload := map[string]interface{}{
		"connectorId": req.ConnectorID,
		"language":    req.Language,
	}

	result, err := s.callOpenHands("/api/generate-tests", payload)
	if err != nil {
		logging.Error("Test generation failed", zap.Error(err), zap.String("jobId", job.ID))
		job.Status = "failed"
		job.Error = err.Error()
		job.UpdatedAt = time.Now()
		return
	}

	job.Status = "completed"
	job.Progress = 100
	job.Result = result
	job.UpdatedAt = time.Now()

	logging.Info("Test generation completed", zap.String("jobId", job.ID))
}

// ValidateConnector validates a connector using OpenHands
func (s *OpenHandsService) ValidateConnector(userID, connectorID string) (*ConnectorValidationResponse, error) {
	// TODO: Fetch connector and tests from database

	payload := map[string]interface{}{
		"connectorId": connectorID,
	}

	result, err := s.callOpenHands("/api/validate-connector", payload)
	if err != nil {
		return nil, fmt.Errorf("failed to validate connector: %w", err)
	}

	// Parse result into ConnectorValidationResponse
	var validation ConnectorValidationResponse
	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %w", err)
	}

	if err := json.Unmarshal(resultBytes, &validation); err != nil {
		return nil, fmt.Errorf("failed to parse validation result: %w", err)
	}

	return &validation, nil
}

// FixConnector fixes a broken connector using OpenHands
func (s *OpenHandsService) FixConnector(userID string, req ConnectorFixRequest) (*ConnectorFixResponse, error) {
	// TODO: Fetch connector from database

	payload := map[string]interface{}{
		"connectorId": req.ConnectorID,
		"error": map[string]interface{}{
			"message":     req.Error.Message,
			"stack":       req.Error.Stack,
			"apiResponse": req.Error.APIResponse,
		},
	}

	result, err := s.callOpenHands("/api/fix-connector", payload)
	if err != nil {
		return nil, fmt.Errorf("failed to fix connector: %w", err)
	}

	// Parse result into ConnectorFixResponse
	var fix ConnectorFixResponse
	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %w", err)
	}

	if err := json.Unmarshal(resultBytes, &fix); err != nil {
		return nil, fmt.Errorf("failed to parse fix result: %w", err)
	}

	return &fix, nil
}

// CreateDocumentationJob creates a documentation generation job
func (s *OpenHandsService) CreateDocumentationJob(userID, connectorID string) (*Job, error) {
	job := &Job{
		ID:        uuid.New().String(),
		UserID:    userID,
		Type:      "documentation_generation",
		Status:    "pending",
		Progress:  0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Start async processing
	go s.processDocumentationGeneration(job, connectorID)

	return job, nil
}

// processDocumentationGeneration processes documentation generation in background
func (s *OpenHandsService) processDocumentationGeneration(job *Job, connectorID string) {
	job.Status = "processing"
	job.Progress = 10
	job.UpdatedAt = time.Now()

	payload := map[string]interface{}{
		"connectorId": connectorID,
	}

	result, err := s.callOpenHands("/api/generate-documentation", payload)
	if err != nil {
		logging.Error("Documentation generation failed", zap.Error(err), zap.String("jobId", job.ID))
		job.Status = "failed"
		job.Error = err.Error()
		job.UpdatedAt = time.Now()
		return
	}

	job.Status = "completed"
	job.Progress = 100
	job.Result = result
	job.UpdatedAt = time.Now()

	logging.Info("Documentation generation completed", zap.String("jobId", job.ID))
}

// GetJobStatus retrieves the status of a job
func (s *OpenHandsService) GetJobStatus(userID, jobID string) (*JobStatusResponse, error) {
	// TODO: Implement job storage in Redis or database
	// For now, return a placeholder

	return &JobStatusResponse{
		JobID:     jobID,
		Status:    "processing",
		Progress:  50,
		CreatedAt: time.Now().Add(-1 * time.Minute).Format(time.RFC3339),
		UpdatedAt: time.Now().Format(time.RFC3339),
	}, nil
}

// callOpenHands makes an HTTP request to the OpenHands adapter
func (s *OpenHandsService) callOpenHands(endpoint string, payload interface{}) (map[string]interface{}, error) {
	// Marshal payload
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create request
	url := s.baseURL + endpoint
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	if s.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}

	// Execute request
	logging.Debug("Calling OpenHands API",
		zap.String("url", url),
		zap.String("payload", string(payloadBytes[:min(200, len(payloadBytes))])),
	)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenHands API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return result, nil
}

// Helper function
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
