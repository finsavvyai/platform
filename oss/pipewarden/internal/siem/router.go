package siem

import (
	"context"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// Router dispatches findings to all configured SIEM destinations.
type Router struct {
	slack   *SlackNotifier
	pd      *PagerDutyNotifier
	jira    *JiraNotifier
	logger  *logging.Logger
	dashURL string
}

// RouterConfig aggregates all SIEM destination configs.
type RouterConfig struct {
	Slack        SlackConfig
	PagerDuty    PagerDutyConfig
	Jira         JiraConfig
	DashboardURL string // base URL for "View Finding" links
}

// NewRouter creates a SIEM router wiring up configured destinations.
func NewRouter(cfg RouterConfig, logger *logging.Logger) *Router {
	return &Router{
		slack:   NewSlackNotifier(cfg.Slack),
		pd:      NewPagerDutyNotifier(cfg.PagerDuty),
		jira:    NewJiraNotifier(cfg.Jira),
		logger:  logger,
		dashURL: cfg.DashboardURL,
	}
}

// Route sends a single finding to all enabled destinations.
// Errors are logged but do not stop delivery to other destinations.
func (r *Router) Route(ctx context.Context, f analysis.Finding) {
	if r.slack.Enabled() {
		if err := r.slack.SendFinding(ctx, f, r.dashURL); err != nil {
			r.logger.Warnw("slack siem delivery failed", "error", err, "finding_id", f.ID)
		}
	}
	if r.pd.Enabled() {
		if err := r.pd.TriggerAlert(ctx, f, r.dashURL); err != nil {
			r.logger.Warnw("pagerduty siem delivery failed", "error", err, "finding_id", f.ID)
		}
	}
	if r.jira.Enabled() {
		key, err := r.jira.CreateIssue(ctx, f)
		if err != nil {
			r.logger.Warnw("jira siem delivery failed", "error", err, "finding_id", f.ID)
		} else if key != "" {
			r.logger.Infow("jira issue created", "key", key, "finding_id", f.ID)
		}
	}
}

// RouteBatch sends a batch summary to Slack and individual alerts to PD/Jira.
func (r *Router) RouteBatch(ctx context.Context, findings []analysis.Finding, connName, runID string) {
	if len(findings) == 0 {
		return
	}

	if r.slack.Enabled() {
		if err := r.slack.SendBatch(ctx, findings, connName, runID, r.dashURL); err != nil {
			r.logger.Warnw("slack batch delivery failed", "error", err)
		}
	}

	// Critical and high findings get individual PD alerts and Jira tickets
	for _, f := range findings {
		if f.Severity != analysis.SeverityCritical && f.Severity != analysis.SeverityHigh {
			continue
		}
		if r.pd.Enabled() {
			if err := r.pd.TriggerAlert(ctx, f, r.dashURL); err != nil {
				r.logger.Warnw("pagerduty batch alert failed", "error", err, "finding_id", f.ID)
			}
		}
		if r.jira.Enabled() {
			key, err := r.jira.CreateIssue(ctx, f)
			if err != nil {
				r.logger.Warnw("jira batch issue failed", "error", err, "finding_id", f.ID)
			} else if key != "" {
				r.logger.Infow("jira issue created", "key", key, "finding_id", f.ID)
			}
		}
	}
}

// Enabled reports whether at least one SIEM destination is configured.
func (r *Router) Enabled() bool {
	return r.slack.Enabled() || r.pd.Enabled() || r.jira.Enabled()
}
