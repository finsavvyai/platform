package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// FixStrategy describes the type of automated fix to apply.
type FixStrategy string

const (
	FixRotateSecret   FixStrategy = "rotate_secret"
	FixBumpDependency FixStrategy = "bump_dependency"
	FixUpdatePipeline FixStrategy = "update_pipeline"
	FixAddSASTStep    FixStrategy = "add_sast_step"
	FixRestrictPerms  FixStrategy = "restrict_permissions"
)

// FixRequest is sent to PushCI to create a fix PR.
type FixRequest struct {
	RepoOwner   string      `json:"repo_owner"`
	RepoName    string      `json:"repo_name"`
	Branch      string      `json:"branch"`
	Strategy    FixStrategy `json:"strategy"`
	FindingID   int64       `json:"finding_id"`
	Category    string      `json:"category"`
	Severity    string      `json:"severity"`
	File        string      `json:"file"`
	Line        int         `json:"line"`
	Title       string      `json:"title"`
	Remediation string      `json:"remediation"`
}

// FixResult is returned by PushCI after creating a fix PR.
type FixResult struct {
	PRURL     string      `json:"pr_url"`
	PRNumber  int         `json:"pr_number"`
	Branch    string      `json:"branch"`
	Strategy  FixStrategy `json:"strategy"`
	CreatedAt time.Time   `json:"created_at"`
	Skipped   bool        `json:"skipped"`
	Reason    string      `json:"reason,omitempty"`
}

// PushCIConfig holds PushCI connection settings.
type PushCIConfig struct {
	APIKey  string
	BaseURL string // default: https://api.pushci.dev
}

// PushCIBridge maps PipeWarden findings to PushCI fix strategies.
type PushCIBridge struct {
	config     PushCIConfig
	httpClient *http.Client
	logger     *logging.Logger
}

// NewPushCIBridge creates a bridge to the PushCI auto-fix API.
func NewPushCIBridge(cfg PushCIConfig, logger *logging.Logger) *PushCIBridge {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.pushci.dev"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	return &PushCIBridge{
		config:     cfg,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		logger:     logger,
	}
}

// Enabled reports whether PushCI credentials are configured. Note that
// this does NOT probe the upstream — call Healthy() to verify reachability.
func (b *PushCIBridge) Enabled() bool {
	return b.config.APIKey != ""
}

// Healthy probes GET <BaseURL>/healthz and returns nil only when the
// upstream responds 200. Today api.pushci.dev returns 404 across the
// surface so this is the gate that keeps CreateFixPR from issuing a
// request that would always fail. Times out after 5 seconds so a slow
// or unreachable host cannot stall scan handlers.
func (b *PushCIBridge) Healthy(ctx context.Context) error {
	if !b.Enabled() {
		return fmt.Errorf("pushci bridge not enabled (APIKey unset)")
	}
	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(probeCtx, http.MethodGet, b.config.BaseURL+"/healthz", nil)
	if err != nil {
		return fmt.Errorf("build healthz request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+b.config.APIKey)
	resp, err := b.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("pushci healthz unreachable: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("pushci healthz returned HTTP %d (upstream not deployed?)", resp.StatusCode)
	}
	return nil
}

// CreateFixPR sends a finding to PushCI and requests an automated fix PR.
// Probes /healthz first (cached per call) so a misconfigured or
// undeployed upstream surfaces a clear error rather than a 404 on the
// fix endpoint.
func (b *PushCIBridge) CreateFixPR(ctx context.Context, owner, repo, branch string, f analysis.Finding) (*FixResult, error) {
	if err := b.Healthy(ctx); err != nil {
		return &FixResult{Skipped: true, Reason: "pushci unhealthy: " + err.Error()}, nil
	}
	strategy := StrategyForFinding(f)
	if strategy == "" {
		return &FixResult{Skipped: true, Reason: "no fix strategy for category " + string(f.Category)}, nil
	}

	req := FixRequest{
		RepoOwner:   owner,
		RepoName:    repo,
		Branch:      branch,
		Strategy:    strategy,
		FindingID:   f.ID,
		Category:    string(f.Category),
		Severity:    string(f.Severity),
		File:        f.File,
		Line:        f.Line,
		Title:       f.Title,
		Remediation: f.Remediation,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal fix request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, b.config.BaseURL+"/v1/fix", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+b.config.APIKey)

	resp, err := b.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("pushci request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pushci API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result FixResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode fix result: %w", err)
	}

	b.logger.Infow("PushCI fix PR created",
		"pr_url", result.PRURL,
		"strategy", strategy,
		"finding_id", f.ID,
	)

	return &result, nil
}

// StrategyForFinding maps a finding's category to a fix strategy.
// Returns empty string if no automated fix is applicable.
func StrategyForFinding(f analysis.Finding) FixStrategy {
	switch f.Category {
	case analysis.CategorySecrets:
		return FixRotateSecret
	case analysis.CategoryDependency:
		return FixBumpDependency
	case analysis.CategoryConfig:
		return FixUpdatePipeline
	case analysis.CategoryAuth, analysis.CategoryAccessControl:
		return FixRestrictPerms
	case analysis.CategoryInjection:
		return FixAddSASTStep
	default:
		return ""
	}
}
