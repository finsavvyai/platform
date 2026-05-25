package aianalysis

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/clawpipe"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/tracing"
)

const defaultModel = "claude-sonnet-4-20250514"

// ClaudeConfig holds configuration for the Claude API client.
type ClaudeConfig struct {
	APIKey  string
	Model   string
	BaseURL string // defaults to https://api.anthropic.com
}

// ClaudeAnalyzer implements security analysis using the Anthropic Claude API.
type ClaudeAnalyzer struct {
	config         ClaudeConfig
	httpClient     *http.Client
	logger         *logging.Logger
	ClawPipeClient *clawpipe.Client
}

// NewClaudeAnalyzer creates a new Claude-powered security analyzer.
func NewClaudeAnalyzer(cfg ClaudeConfig, logger *logging.Logger) *ClaudeAnalyzer {
	if cfg.Model == "" {
		cfg.Model = defaultModel
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.anthropic.com"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")

	return &ClaudeAnalyzer{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
		logger: logger,
	}
}

// SetHTTPClient allows overriding the HTTP client for testing.
func (a *ClaudeAnalyzer) SetHTTPClient(client *http.Client) {
	a.httpClient = client
}

// SetClawPipe sets the ClawPipe client for optional routing through ClawPipe.
func (a *ClaudeAnalyzer) SetClawPipe(client *clawpipe.Client) {
	a.ClawPipeClient = client
}

// AnalyzeRun performs security analysis on a pipeline run using Claude.
//
// Mythos principle 6 ("when unsure, stop"): if any CI-controlled field
// matches a known prompt-injection signature, the Claude call is skipped
// and the caller receives a single high-confidence "policy" finding that
// records the trigger. The rest of the pipeline (heuristic + DLP) still
// runs upstream, so the user does not lose coverage — they lose the
// outbound LLM hop, which is the lethal-trifecta exit.
func (a *ClaudeAnalyzer) AnalyzeRun(ctx context.Context, conn *integrations.Connection, run *integrations.PipelineRun) (*analysis.AnalysisResult, error) {
	defer tracing.Region(ctx, "pipewarden.scan")()
	start := time.Now()

	if hit, field, sample := detectInjection(conn, run); hit {
		a.logger.Warnw("Mythos gate: prompt-injection signature in CI input — Claude call skipped",
			"connection", conn.Name,
			"run_id", run.ID,
			"field", field,
		)
		return mythosBlockedResult(conn, run, field, sample, start), nil
	}

	prompt := buildAnalysisPrompt(conn, run)

	a.logger.Infow("Starting Claude security analysis",
		"connection", conn.Name,
		"run_id", run.ID,
		"model", a.config.Model,
	)

	response, err := a.callClaude(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("claude API call failed: %w", err)
	}

	findings, summary, riskScore := parseClaudeResponse(response.Content, conn.Name, run.ID)

	result := &analysis.AnalysisResult{
		ConnectionName: conn.Name,
		RunID:          run.ID,
		Findings:       findings,
		Summary:        summary,
		RiskScore:      riskScore,
		TokensUsed:     response.Usage.InputTokens + response.Usage.OutputTokens,
		Model:          a.config.Model,
		AnalyzedAt:     time.Now().UTC(),
		DurationMS:     time.Since(start).Milliseconds(),
	}

	a.logger.Infow("Security analysis complete",
		"connection", conn.Name,
		"run_id", run.ID,
		"findings", len(findings),
		"risk_score", riskScore,
		"tokens_used", result.TokensUsed,
		"duration_ms", result.DurationMS,
	)

	return result, nil
}

// Enabled returns whether the analyzer has an API key configured.
func (a *ClaudeAnalyzer) Enabled() bool {
	return a.config.APIKey != ""
}
