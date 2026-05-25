package main

import (
	"database/sql"
	"log"

	"github.com/aegis-aml/aegis/api"
	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

func initDeps(
	db *sql.DB,
	engine *screening.Engine,
	entities *pgx.EntityRepository,
) *api.Dependencies {
	deps := api.NewDependencies(
		pgx.NewTenantRepository(db),
		entities,
		pgx.NewScreeningRepository(db),
		pgx.NewAlertRepository(db),
		pgx.NewAuditRepository(db),
		engine,
	)
	deps.DB = db
	deps.Users = pgx.NewUserRepository(db)
	deps.Seats = pgx.NewSeatRepository(db)
	deps.Cases = pgx.NewCaseRepository(db)
	deps.CaseComments = pgx.NewCaseCommentRepository(db)
	deps.CaseQueries = pgx.NewCaseQueryRepository(db)
	deps.Monitors = pgx.NewMonitorRepository(db)
	deps.UBOs = pgx.NewUBORepository(db)
	deps.EDDs = pgx.NewEDDRepository(db)
	deps.Txns = pgx.NewTransactionRepository(db)
	deps.TxnAlerts = pgx.NewTxnAlertRepository(db)
	deps.Clusters = pgx.NewEntityClusterRepository(db)
	deps.Media = pgx.NewAdverseMediaRepository(db)
	deps.PEPs = pgx.NewPEPRepository(db)
	deps.Batches = pgx.NewBatchRepository(db)
	deps.BatchResults = pgx.NewBatchResultRepository(db)
	deps.Usage = pgx.NewUsageRepository(db)
	deps.SARs = pgx.NewSARRepository(db)
	deps.MonitorProfiles = pgx.NewMonitorProfileRepository(db)
	deps.MonitorAlerts = pgx.NewMonitorAlertRepository(db)

	subs := pgx.NewSubscriptionRepository(db)
	invoices := pgx.NewInvoiceRepository(db)
	events := pgx.NewBillingEventRepository(db)
	lsCfg, err := billing.LoadLemonSqueezyConfig()
	if err != nil {
		log.Printf("billing: LemonSqueezy config not set: %v", err)
		lsCfg = nil
	}
	deps.BillingSvc = billing.NewBillingService(
		lsCfg, subs, deps.Usage, invoices, events,
	)
	deps.Enforcer = billing.NewEnforcer(subs, deps.Usage)

	return deps
}
