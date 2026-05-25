// Wiring for the BEAT-PLAN S1.1 trio: RBAC evaluator + audit Writer +
// audit Reader. Each is no-op-when-unconfigured so the binary still
// boots when AUDIT_SIGNING_KEY is missing in dev.
//
// Kept out of main.go so the file stays focused on lifecycle concerns
// and the wiring stays auditable on its own.

package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/stdlib"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/rbac"
	infaudit "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/audit"
	infauth "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/auth"
	infcompliance "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/compliance"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/drift"
	infmw "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/network"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
	infrbac "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/rbac"
	infretention "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/retention"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/webhooks"

	domretention "github.com/sdlc-ai/platform/services/gateway/internal/domain/retention"
)

// SecuritySuite groups the RBAC + audit primitives that the chain
// needs together. A nil field means the corresponding step degrades
// to a no-op so dev environments without the signing key keep working.
type SecuritySuite struct {
	Evaluator         *rbac.Evaluator
	AuditWriter       *infaudit.Writer
	AuditReader       *infaudit.PgxReader
	DLP               *infmw.DLP
	RateLimitAdmin    *ratelimit.AdminRepo        // Day-7 admin CRUD; nil when sql.DB unavailable
	APIKeyRotator     *infauth.Rotator            // Day-9 rotation/revoke; nil when sql.DB unavailable
	IPAllowListLoad   *network.PgxLoader          // Day-26 per-tenant IP allowlist loader
	ComplianceReaders *infcompliance.PgxReaders   // Day-32 RBAC/Retention/DLPEvent readers
	RetentionSweeper  *domretention.Sweeper       // Day-33 daily retention sweep
	WebhookDispatcher *webhooks.Dispatcher        // Day-38 outbound webhook fan-out
	auditSQLDB        *sql.DB                     // owned, closed on Shutdown
}

// Close releases resources owned by the suite. Safe to call when
// fields are nil (e.g. dev boot without AUDIT_SIGNING_KEY).
func (s *SecuritySuite) Close() {
	if s == nil {
		return
	}
	if s.AuditWriter != nil {
		s.AuditWriter.Close()
	}
	if s.auditSQLDB != nil {
		_ = s.auditSQLDB.Close()
	}
}

// initSecuritySuite constructs the RBAC evaluator + audit Writer +
// audit Reader against the live pgxpool. Returns a usable suite even
// when the audit signing key is missing — only the audit pieces are
// disabled in that case so RBAC stays available.
func initSecuritySuite(ctx context.Context, db *database.Database, log *logrus.Logger) *SecuritySuite {
	suite := &SecuritySuite{}
	if db == nil || db.GetPool() == nil {
		return suite
	}

	suite.Evaluator = rbac.NewEvaluator(infrbac.NewPgxLoader(db.GetPool()), 60*time.Second)
	suite.AuditReader = infaudit.NewPgxReader(db.GetPool())
	// Day-26 per-tenant IP allowlist. Loader uses the same pgxpool;
	// the chain consults LookupTenant on every request when the
	// tenant has network_mode='private_only'.
	suite.IPAllowListLoad = network.NewPgxLoader(db.GetPool())
	// Day-32 compliance readers (RBAC snapshot, retention status,
	// DLP events). All read-only against the same pool.
	suite.ComplianceReaders = infcompliance.NewPgxReaders(db.GetPool())
	// Day-33 retention sweeper. Starts a 24h ticker that purges rows
	// past their per-tenant retention window. Survives transient
	// errors; legal-hold rows pass through.
	if sw, err := infretention.Wire(ctx, db.GetPool(), retentionLogFn(log)); err == nil {
		suite.RetentionSweeper = sw
	} else if log != nil {
		log.WithError(err).Warn("retention sweeper not started")
	}

	// BEAT-PLAN S1.3: DLP detector + per-tenant policy lookup. Audit
	// hook is wired below once the Writer is constructed; nil-tolerant
	// when AUDIT_SIGNING_KEY is missing.
	suite.DLP = infmw.NewDLP(
		infmw.NewDetector(),
		infmw.NewPgxPolicyLookup(db.GetPool()),
		nil, // audit hook attached below if Writer wires successfully
	)

	key := []byte(os.Getenv("AUDIT_SIGNING_KEY"))
	if len(key) < 32 {
		if log != nil {
			log.Warn("AUDIT_SIGNING_KEY missing or shorter than 32 bytes; HMAC audit log disabled")
		}
		return suite
	}
	signer, err := infaudit.NewSigner(key)
	if err != nil {
		if log != nil {
			log.WithError(err).Warn("audit signer init failed; HMAC audit log disabled")
		}
		return suite
	}

	sqlDB := stdlib.OpenDBFromPool(db.GetPool())
	if err := sqlDB.PingContext(ctx); err != nil {
		_ = sqlDB.Close()
		if log != nil {
			log.WithError(err).Warn("audit sql.DB ping failed; HMAC audit log disabled")
		}
		return suite
	}
	suite.auditSQLDB = sqlDB
	suite.AuditWriter = infaudit.NewWriter(sqlDB, signer, slogFromLogrus(log), 0)
	if suite.DLP != nil {
		suite.DLP.Audit = suite.AuditWriter
	}
	// Day-7 admin rate-limit CRUD shares the same sql.DB the audit
	// Writer uses. Cache is nil — the Lua-script limiter reads its
	// rules table directly, so we don't need to invalidate a cache.
	suite.RateLimitAdmin = ratelimit.NewAdminRepo(sqlDB, nil)
	// Day-9 API key rotator. 5-minute default grace lets the old key
	// keep validating while the caller distributes the new one. Admins
	// can pass a custom grace via the rotate request body.
	suite.APIKeyRotator = infauth.NewRotator(sqlDB, 5*time.Minute)
	// Day-9 sweeper: revoke api_keys whose grace window expired. Runs
	// every 5 min until ctx cancellation; survives transient DB errors
	// via the slog warning path.
	apiKeySweeper := infauth.NewSweeper(sqlDB, slogFromLogrus(log), 5*time.Minute)
	go func() {
		_ = apiKeySweeper.Run(ctx)
	}()
	// Day-38 webhook dispatcher. Persistent DLQ on the same sql.DB
	// the audit Writer uses; Retrier uses the canonical 30s/2m/10m/
	// 1h/4h schedule. Dispatch is fire-and-forget — call sites in
	// the request path don't block on outbound delivery.
	suite.WebhookDispatcher = webhooks.NewDispatcher(
		webhooks.NewPgxEndpointStore(db.GetPool()),
		webhooks.NewRetrier(webhooks.NewPostgresDLQ(sqlDB)),
	)
	// Claude Team D4 — drift detector ticker. Hourly evaluation of
	// per-tenant DLP detection counts vs 7-day rolling baseline;
	// 2σ deviations fire the WebhookDispatcher with event type
	// `dlp.drift.alert`. Survives transient DB errors via the
	// detector's per-tenant try/skip loop.
	driftDetector := drift.NewDetector(
		drift.NewPgxReader(db.GetPool()),
		suite.WebhookDispatcher,
	)
	driftDetector.Log = func(msg string, err error) {
		if log != nil {
			log.WithError(err).Warn(msg)
		}
	}
	go driftDetector.Run(ctx)

	if log != nil {
		log.Info("HMAC audit Writer wired")
	}
	return suite
}

// retentionLogFn returns the callback the retention sweeper uses to
// surface daily sweep results. logrus -> structured fields so an
// auditor can correlate "rows purged" against the audit_logs row that
// records the same operation.
func retentionLogFn(log *logrus.Logger) func(string, error, int) {
	if log == nil {
		return func(string, error, int) {}
	}
	return func(msg string, err error, purged int) {
		entry := log.WithField("purged", purged)
		if err != nil {
			entry.WithError(err).Warn(msg)
			return
		}
		entry.Info(msg)
	}
}

// slogFromLogrus bridges logrus to the slog handler the audit Writer
// expects. The Writer only logs warnings on async drops, so a thin
// adapter is enough.
func slogFromLogrus(l *logrus.Logger) *slog.Logger {
	if l == nil {
		return slog.Default()
	}
	return slog.New(slog.NewTextHandler(l.Out, &slog.HandlerOptions{Level: slog.LevelWarn}))
}

// auditWriterFromSuite returns the writer when configured, else nil.
// Used by the chain so an empty suite degrades to logrus-only audit.
func auditWriterFromSuite(s *SecuritySuite) *infaudit.Writer {
	if s == nil {
		return nil
	}
	return s.AuditWriter
}

// suiteSummary is used by /info to surface which security primitives
// are wired without leaking the signing key. Returns a stable shape.
func suiteSummary(s *SecuritySuite) map[string]bool {
	return map[string]bool{
		"rbac_evaluator": s != nil && s.Evaluator != nil,
		"audit_writer":   s != nil && s.AuditWriter != nil,
		"audit_reader":   s != nil && s.AuditReader != nil,
	}
}

// suiteError is here so this file owns its own error helpers and
// nothing in main.go has to learn about the suite's internals.
type suiteError string

func (e suiteError) Error() string { return string(e) }

const errSuiteNotConfigured suiteError = "security suite is not configured"

// MustSuite returns the suite or an error so callers in tests can
// fail fast instead of hitting nil-pointer derefs in chain.go.
func MustSuite(s *SecuritySuite) (*SecuritySuite, error) {
	if s == nil || s.Evaluator == nil {
		return nil, fmt.Errorf("%w: rbac evaluator not built", errSuiteNotConfigured)
	}
	return s, nil
}
