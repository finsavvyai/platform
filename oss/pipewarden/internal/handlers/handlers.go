package handlers

import (
	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/billing"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/email"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/search"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
	"github.com/finsavvyai/pipewarden/internal/webhooks"
)

// Handlers holds references to all dependencies for HTTP handlers.
type Handlers struct {
	db                *storage.DB
	manager           *integrations.Manager
	claudeAnalyzer    *aianalysis.ClaudeAnalyzer
	heuristicAnalyzer *analysis.HeuristicAnalyzer
	logger            *logging.Logger
	vault             *vault.Vault
	cfg               *config.Config
	billingClient     *billing.Client
	auditSender       *webhooks.AuditSender
	openSRESender     *webhooks.OpenSRESender
	ProgressRegistry  *ScanProgressRegistry
	AutoScanQueue     *AutoScanQueue
	searchClient      *search.Client
	localSearch       *search.LocalIndex
	email             *email.Sender
}

// New creates a new Handlers instance.
func New(
	db *storage.DB,
	manager *integrations.Manager,
	claudeAnalyzer *aianalysis.ClaudeAnalyzer,
	heuristicAnalyzer *analysis.HeuristicAnalyzer,
	logger *logging.Logger,
	v *vault.Vault,
	cfgs ...*config.Config,
) *Handlers {
	var cfg *config.Config
	if len(cfgs) > 0 {
		cfg = cfgs[0]
	}

	var billingClient *billing.Client
	if cfg != nil {
		billingClient = billing.New(billing.LemonSqueezyConfig{
			APIKey:     cfg.Billing.LemonSqueezyAPIKey,
			StoreID:    cfg.Billing.LemonSqueezyStoreID,
			WebhookKey: cfg.Billing.LemonSqueezyWebhookSecret,
		})
	}

	var auditSender *webhooks.AuditSender
	if cfg != nil {
		auditSender = webhooks.NewAuditSender(cfg.Audit.Endpoint, cfg.Audit.Token, logger)
	}

	var openSRESender *webhooks.OpenSRESender
	if cfg != nil {
		openSRESender = webhooks.NewOpenSRESender(cfg.OpenSRE.URL, cfg.OpenSRE.Secret, logger)
	}

	h := &Handlers{
		db:                db,
		manager:           manager,
		claudeAnalyzer:    claudeAnalyzer,
		heuristicAnalyzer: heuristicAnalyzer,
		logger:            logger,
		vault:             v,
		cfg:               cfg,
		billingClient:     billingClient,
		auditSender:       auditSender,
		openSRESender:     openSRESender,
		ProgressRegistry:  NewScanProgressRegistry(),
		AutoScanQueue:     NewAutoScanQueue(),
		searchClient:      search.New(),
		localSearch:       search.NewLocalIndex(),
		email:             email.NewFromEnv(),
	}
	// Hydrate the local search index from existing findings on boot. Keeps
	// /api/v1/findings/search working immediately without waiting for new
	// scans. Errors are logged but never block startup — search is best-
	// effort.
	if db != nil {
		if existing, err := db.ListFindings(""); err == nil {
			for _, f := range existing {
				h.localSearch.Add(findingDoc{f})
			}
		} else if logger != nil {
			logger.Warnw("local search hydrate failed", "error", err)
		}
	}
	return h
}

// findingDoc adapts FindingRecord to search.Document.
type findingDoc struct{ rec storage.FindingRecord }

func (d findingDoc) DocID() int64 { return d.rec.ID }
func (d findingDoc) DocText() string {
	return d.rec.Title + " " + d.rec.Description + " " + d.rec.Remediation +
		" " + d.rec.Category + " " + d.rec.File
}
func (d findingDoc) DocLabel() string { return d.rec.Title }
