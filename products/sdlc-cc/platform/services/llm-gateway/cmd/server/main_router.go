package main

import (
	"fmt"

	"github.com/SDLC/llm-gateway/internal/api/handlers"
	"github.com/SDLC/llm-gateway/internal/config"
	"github.com/SDLC/llm-gateway/internal/llm"
	"github.com/SDLC/llm-gateway/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
)

// setupRouter configures the HTTP router
func setupRouter(cfg *config.Config, gateway *llm.Gateway, logger *logrus.Logger) *gin.Engine {
	gin.SetMode(cfg.Server.GinMode)
	router := gin.New()
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())
	if cfg.Auth.Enabled {
		router.Use(middleware.Authentication())
	}
	handler := handlers.NewHandler(gateway, logger)
	api := router.Group("/api/v1")
	{
		api.POST("/complete", handler.Complete)
		api.POST("/complete/stream", handler.CompleteStream)
		api.GET("/models", handler.Models)
		api.GET("/providers", handler.Providers)
		api.POST("/providers/:provider/enable", handler.EnableProvider)
		api.POST("/providers/:provider/disable", handler.DisableProvider)
		api.GET("/health", handler.Health)
		api.GET("/stats/usage", handler.GetUsageStats)
		api.GET("/stats/costs", handler.GetCostHistory)
		api.POST("/validate", handler.ValidateRequest)
	}
	router.Static("/docs", "./docs")
	router.GET("/", func(c *gin.Context) { c.Redirect(302, "/docs") })
	router.GET("/healthz", handler.Health)
	return router
}

// startMonitoringServer starts the Prometheus monitoring server
func startMonitoringServer(cfg config.MonitoringConfig, logger *logrus.Logger) {
	router := gin.New()
	router.GET(cfg.Path, gin.WrapH(promhttp.Handler()))
	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.WithFields(logrus.Fields{"addr": addr, "path": cfg.Path}).Info("Starting monitoring server")
	if err := router.Run(addr); err != nil {
		logger.WithError(err).Error("Monitoring server failed to start")
	}
}
