// Package jenkins provides the PipeWarden Jenkins plugin bridge.
// The plugin sends post-build scan requests to a PipeWarden server,
// enabling Jenkins pipelines to get security findings without modifying Jenkinsfiles.
//
// Deployment path:
//  1. Build this as a Go binary: make build-jenkins-plugin
//  2. Install on Jenkins host or as a Docker sidecar
//  3. Configure PIPEWARDEN_URL + PIPEWARDEN_TOKEN in Jenkins credentials store
//  4. Add a post-build step that calls: pipewarden-jenkins --job $JOB_NAME --build $BUILD_NUMBER
package jenkins

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// PluginConfig holds all configuration for the Jenkins plugin bridge.
type PluginConfig struct {
	ServerURL   string // PipeWarden server URL, e.g. https://app.pipewarden.com
	Token       string // PipeWarden API token or GitHub PAT
	Connection  string // PipeWarden connection name to associate results with
	JobName     string // Jenkins job name ($JOB_NAME)
	BuildNumber string // Jenkins build number ($BUILD_NUMBER)
	BuildURL    string // Jenkins build URL ($BUILD_URL)
	Branch      string // Git branch ($GIT_BRANCH)
	CommitSHA   string // Git commit ($GIT_COMMIT)
	Timeout     time.Duration
}

// PluginConfigFromEnv reads standard Jenkins environment variables to build a PluginConfig.
// Required: PIPEWARDEN_URL, PIPEWARDEN_TOKEN
// Auto-populated from Jenkins: JOB_NAME, BUILD_NUMBER, BUILD_URL, GIT_BRANCH, GIT_COMMIT
func PluginConfigFromEnv() PluginConfig {
	return PluginConfig{
		ServerURL:   strings.TrimRight(os.Getenv("PIPEWARDEN_URL"), "/"),
		Token:       os.Getenv("PIPEWARDEN_TOKEN"),
		Connection:  os.Getenv("PIPEWARDEN_CONNECTION"),
		JobName:     os.Getenv("JOB_NAME"),
		BuildNumber: os.Getenv("BUILD_NUMBER"),
		BuildURL:    os.Getenv("BUILD_URL"),
		Branch:      os.Getenv("GIT_BRANCH"),
		CommitSHA:   os.Getenv("GIT_COMMIT"),
		Timeout:     120 * time.Second,
	}
}

// ScanRequest is the payload sent to PipeWarden's quick-scan endpoint.
type ScanRequest struct {
	ConnectionName string `json:"connection_name"`
	RunID          string `json:"run_id"`
	Branch         string `json:"branch,omitempty"`
	CommitSHA      string `json:"commit_sha,omitempty"`
	BuildURL       string `json:"build_url,omitempty"`
	Platform       string `json:"platform"`
}

// ScanResponse is the response from PipeWarden's quick-scan endpoint.
type ScanResponse struct {
	FindingsCount int    `json:"findings_count"`
	RiskScore     int    `json:"risk_score"`
	Summary       string `json:"summary"`
	ScanID        string `json:"scan_id"`
}

// Plugin drives a post-build security scan via PipeWarden REST API.
type Plugin struct {
	cfg        PluginConfig
	httpClient *http.Client
}

// New creates a new Jenkins plugin bridge instance.
func New(cfg PluginConfig) *Plugin {
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 120 * time.Second
	}
	return &Plugin{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: timeout},
	}
}

// Validate checks that required configuration is present.
func (p *Plugin) Validate() error {
	if p.cfg.ServerURL == "" {
		return fmt.Errorf("PIPEWARDEN_URL is required")
	}
	if p.cfg.Token == "" {
		return fmt.Errorf("PIPEWARDEN_TOKEN is required")
	}
	if p.cfg.JobName == "" {
		return fmt.Errorf("JOB_NAME is required (set by Jenkins automatically)")
	}
	return nil
}

// TriggerScan sends a post-build scan request to PipeWarden.
// Returns the scan response with findings count and risk score.
func (p *Plugin) TriggerScan(ctx context.Context) (*ScanResponse, error) {
	if err := p.Validate(); err != nil {
		return nil, err
	}

	connName := p.cfg.Connection
	if connName == "" {
		connName = p.cfg.JobName
	}

	runID := fmt.Sprintf("jenkins-%s-%s", p.cfg.JobName, p.cfg.BuildNumber)

	req := ScanRequest{
		ConnectionName: connName,
		RunID:          runID,
		Branch:         p.cfg.Branch,
		CommitSHA:      p.cfg.CommitSHA,
		BuildURL:       p.cfg.BuildURL,
		Platform:       "jenkins",
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal scan request: %w", err)
	}

	url := p.cfg.ServerURL + "/api/v1/analysis/quick"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.cfg.Token)
	httpReq.Header.Set("X-PipeWarden-Source", "jenkins-plugin/1.0")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("scan request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pipewarden error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result ScanResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// ExitCode returns a Jenkins-compatible exit code based on scan results.
// Exits 0 on success, 1 if risk score >= threshold, 2 on scan error.
func ExitCode(result *ScanResponse, riskThreshold int) int {
	if result == nil {
		return 2
	}
	if result.RiskScore >= riskThreshold {
		return 1
	}
	return 0
}
