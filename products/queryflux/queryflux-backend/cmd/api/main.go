package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/queryflux/backend/internal/adapter"
	"github.com/queryflux/backend/internal/port"
	"github.com/queryflux/backend/internal/service"
	"github.com/queryflux/backend/pkg/config"
	"github.com/queryflux/backend/pkg/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	appLogger := logger.New(cfg.LogLevel)

	dbAdapter, err := adapter.NewPostgresAdapterWithConfig(cfg.DatabaseURL, cfg.Pool)
	if err != nil {
		appLogger.Error("Failed to initialize database adapter", "error", err)
		log.Fatal(err)
	}
	defer dbAdapter.Close()

	pool := dbAdapter.GetPool()
	userRepo := adapter.NewUserRepositoryPostgres(pool)
	connRepo := adapter.NewConnectionRepositoryPostgres(pool)
	sqRepo := adapter.NewSavedQueryRepositoryPostgres(pool)

	jwtService := service.NewJWTService(cfg.JWTSecret)
	queryService := service.NewQueryService(dbAdapter, appLogger)
	schemaService := service.NewSchemaService(dbAdapter, appLogger)
	authService := service.NewAuthService(userRepo, jwtService)
	connService := service.NewConnectionService(connRepo, cfg.EncryptionKey)
	sqService := service.NewSavedQueryService(sqRepo)

	adapterFactory := func(dsn string) (port.DatabasePort, error) {
		return adapter.NewPostgresAdapter(dsn)
	}
	poolManager := service.NewPoolManager(connService, dbAdapter, adapterFactory)
	defer poolManager.Close()
	queryService.SetPoolManager(poolManager)
	schemaService.SetPoolManager(poolManager)

	authMiddleware := adapter.NewAuthMiddleware(jwtService)
	connHandler := adapter.NewConnectionHandler(connService)
	dbHandler := adapter.NewDatabaseHandler(queryService, schemaService)
	sqHandler := adapter.NewSavedQueryHandler(sqService)

	server := adapter.NewHTTPServer(
		cfg, queryService, schemaService, authService, authMiddleware, appLogger,
		adapter.WithConnectionHandler(connHandler),
		adapter.WithDatabaseHandler(dbHandler),
		adapter.WithSavedQueryHandler(sqHandler),
	)

	go func() {
		appLogger.Info("Starting QueryFlux API server", "port", cfg.Port)
		if err := server.Start(); err != nil {
			appLogger.Error("Server failed to start", "error", err)
			log.Fatal(err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	appLogger.Info("Shutting down server...")
	ctx := context.Background()
	if err := server.Shutdown(ctx); err != nil {
		appLogger.Error("Server forced to shutdown", "error", err)
	}

	appLogger.Info("Server exited")
}
