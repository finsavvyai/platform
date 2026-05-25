package api

import (
	"database/sql"

	"github.com/aegis-aml/aegis/internal/automation"
	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/pipeline"
	"github.com/aegis-aml/aegis/internal/reporting"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
	"github.com/aegis-aml/aegis/internal/tasklog"
)

type Dependencies struct {
	DB           *sql.DB
	Tenants      storage.TenantRepository
	Entities     storage.EntityRepository
	Screenings   storage.ScreeningRepository
	Alerts       storage.AlertRepository
	Audit        storage.AuditRepository
	Batches      storage.BatchRepository
	BatchResults storage.BatchResultRepository
	Seats        storage.SeatRepository
	Users        storage.UserRepository
	Usage        storage.UsageRepository
	Cases        storage.CaseRepository
	CaseComments storage.CaseCommentRepository
	CaseQueries  storage.CaseQueryRepository
	Monitors     storage.MonitorRepository
	UBOs         storage.UBORepository
	EDDs         storage.EDDRepository
	Txns         storage.TransactionRepository
	TxnAlerts    storage.TxnAlertRepository
	Clusters        storage.EntityClusterRepository
	Media           storage.AdverseMediaRepository
	PEPs            storage.PEPRepository
	MonitorProfiles storage.MonitorProfileRepository
	MonitorAlerts   storage.MonitorAlertRepository
	SARs            storage.SARRepository
	SARGenerator    *reporting.SARGenerator
	Enforcements    EnforcementRepository
	HealthTracker *ingestion.HealthTracker
	Engine       *screening.Engine
	FastEngine   *screening.FastEngine
	CryptoIdx    *screening.CryptoIndex
	SyncSvc      *ingestion.SyncService
	RefreshSvc   *ingestion.RefreshService
	BillingSvc   *billing.BillingService
	Enforcer      *billing.Enforcer
	Metrics       *pipeline.Metrics
	BatchStreamer    *pipeline.BatchStreamer
	ScreenQueue     *pipeline.ScreeningQueue
	TaskRegistry    *tasklog.Registry
	AlertConfigStore *AlertConfigStore
	CryptoSyncSvc    *ingestion.CryptoSyncService
	CountryRiskIdx   *domain.CountryRiskIndex
	WebhookSecrets   *WebhookSecretStore
	AutomationRules  automation.Store
	AutomationExec   *automation.Executor
	// AIRequestLog persists one row per provider call for ops +
	// compliance + cost dashboards. nil-tolerant: handlers no-op
	// the write so dev / no-DB runs still work.
	AIRequestLog storage.AIRequestLogRepository
}

func NewDependencies(
	tenants storage.TenantRepository,
	entities storage.EntityRepository,
	screenings storage.ScreeningRepository,
	alerts storage.AlertRepository,
	audit storage.AuditRepository,
	engine *screening.Engine,
) *Dependencies {
	return &Dependencies{
		Tenants:    tenants,
		Entities:   entities,
		Screenings: screenings,
		Alerts:     alerts,
		Audit:      audit,
		Engine:     engine,
	}
}
