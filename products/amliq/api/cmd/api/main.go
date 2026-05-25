package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/aegis-aml/aegis/api"
	"github.com/aegis-aml/aegis/internal/analytics"
	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/pipeline"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
	"github.com/aegis-aml/aegis/internal/tasklog"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()
	oauthCfg := config.LoadOAuth()
	analytics.Configure(analytics.FromEnv())

	pool, err := pgx.NewPool(cfg.Database.URL)
	if err != nil {
		log.Fatalf("pool init: %v", err)
	}
	defer pool.Close()
	db := pool.DB()
	ctx := context.Background()

	migrator := pgx.NewMigrator(db, os.DirFS("."))
	if err := migrator.Up(ctx); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	entityRepo := pgx.NewEntityRepository(db)

	// Create engine with flat index first (fast startup). Heavy
	// indexes load in background after the port is listening.
	engine := screening.NewEngine(nil)
	deps := initDeps(db, engine, entityRepo)
	deps.CryptoIdx = screening.NewCryptoIndex()
	deps.TaskRegistry = tasklog.NewRegistry(500)
	deps.CryptoSyncSvc = ingestion.NewCryptoSyncService(
		pgx.NewCryptoRepo(db), deps.CryptoIdx)
	buildIngestionSvc(pool, entityRepo, deps)

	// Start server IMMEDIATELY so Render detects the port.
	server := api.NewServer(fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port))
	server.WithSecurityLog(api.NewSecurityLogWriter(db))
	limiter := api.NewRateLimiter(100, 100)
	chain := api.ChainMiddleware(
		api.JWTMiddleware(cfg.Auth.TokenSecret), limiter.Middleware(),
	)
	workers := envInt("WORKERS", pipeline.DefaultWorkers)
	depth := envInt("QUEUE_DEPTH", pipeline.DefaultQueueDepth)
	queue := pipeline.NewScreeningQueue(depth, workers)
	metrics := pipeline.NewMetrics(queue.Depth)
	queue.Process(ctx, pipeline.NewWorker(engine, metrics))
	deps.Metrics = metrics
	deps.ScreenQueue = queue
	deps.BatchStreamer = pipeline.NewBatchStreamer(engine, workers)

	wireRedisCache(cfg, engine)
	api.SetupRoutes(server.GetMux(), deps, chain, cfg.Auth, oauthCfg)
	startProfileServer(resolveProfilePort())

	log.Printf("AEGIS API starting on %s:%d", cfg.Server.Host, cfg.Server.Port)

	// Background: load heavy indexes AFTER server is listening.
	go func() {
		loadHeavyIndexes(pool, entityRepo, engine, deps)
		setupIngestion(ctx, entityRepo, engine, deps)
	}()

	if err := server.Start(); err != nil {
		log.Fatalf("server: %v", err)
	}
}

func resolveProfilePort() string {
	p := os.Getenv("PPROF_PORT")
	if p == "" {
		return ":6060"
	}
	return p
}
