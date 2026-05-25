package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// OpenHandsProvider implements AIProvider for the centralized OpenHands AI Engine
type OpenHandsProvider struct {
	baseURL     string
	apiKey      string // Optional, for future auth
	httpClient  *http.Client
	logger      *logrus.Logger
	lastHealthy time.Time
	healthMutex sync.RWMutex
}

// NewOpenHandsProvider creates a new OpenHands provider
func NewOpenHandsProvider(baseURL string, apiKey string) *OpenHandsProvider {
	if baseURL == "" {
		baseURL = "http://localhost:8787" // Default to local dev
	}

	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	return &OpenHandsProvider{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		logger:      logger,
		lastHealthy: time.Now(),
	}
}

// Name returns the provider name
func (p *OpenHandsProvider) Name() string {
	return "openhands"
}

type openHandsSQLRequest struct {
	Prompt string `json:"prompt"`
	Schema string `json:"schema"`
}

type openHandsSQLResponse struct {
	SQL string `json:"sql"`
}

type openHandsOptimizeRequest struct {
	Query  string `json:"query"`
	Schema string `json:"schema"`
}

type openHandsOptimizeResponse struct {
	OptimizedQuery       string `json:"optimizedQuery"`
	Explanation          string `json:"explanation"`
	EstimatedImprovement string `json:"estimatedImprovement"`
}

// ConvertNLToSQL converts natural language to SQL using OpenHands Engine
func (p *OpenHandsProvider) ConvertNLToSQL(ctx context.Context, prompt string, schema string) (string, error) {
	reqBody := openHandsSQLRequest{
		Prompt: prompt,
		Schema: schema,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/queryflux/generate-sql", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		p.logger.WithError(err).Error("OpenHands AI Engine call failed")
		p.markUnhealthy()
		return "", fmt.Errorf("OpenHands AI Engine error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		p.markUnhealthy()
		return "", fmt.Errorf("OpenHands AI Engine returned status %d: %s", resp.StatusCode, string(body))
	}

	var engineResp openHandsSQLResponse
	if err := json.NewDecoder(resp.Body).Decode(&engineResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	p.markHealthy()
	return strings.TrimSpace(engineResp.SQL), nil
}

// IsHealthy checks if the provider is currently healthy
func (p *OpenHandsProvider) IsHealthy(ctx context.Context) bool {
	p.healthMutex.RLock()
	defer p.healthMutex.RUnlock()

	// Simple heuristic: healthy if last success was recent
	return time.Since(p.lastHealthy) < 5*time.Minute
}

func (p *OpenHandsProvider) markHealthy() {
	p.healthMutex.Lock()
	defer p.healthMutex.Unlock()
	p.lastHealthy = time.Now()
}

func (p *OpenHandsProvider) markUnhealthy() {
	p.healthMutex.Lock()
	defer p.healthMutex.Unlock()
	p.lastHealthy = time.Time{}
}
