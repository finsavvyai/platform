package ui

import (
	"context"
	"fmt"
	"time"

	"finsavvyai-desktop/config"
	"finsavvyai-desktop/services"

	"github.com/sirupsen/logrus"
)

// Initialize sets up the desktop UI components
func Initialize(cfg *config.Config, logger *logrus.Logger, clusterService *services.ClusterService, wsHub *services.WSHub) {
	logger.Info("Initializing FinSavvyAI desktop application UI")

	// Start system monitoring
	go startSystemMonitoring(clusterService, wsHub, logger)

	// Show startup notification
	uiService := services.NewUIService(cfg, logger)
	if cfg.UI.ShowNotifications {
		uiService.ShowNotification(
			"FinSavvyAI Desktop",
			"Application started successfully",
			"low",
		)
	}

	logger.Info("Desktop UI initialization complete")
}

func startSystemMonitoring(clusterService *services.ClusterService, wsHub *services.WSHub, logger *logrus.Logger) {
	startSystemMonitoringWithCtx(context.Background(), clusterService, wsHub, logger, 30*time.Second)
}

func startSystemMonitoringWithCtx(ctx context.Context, clusterService *services.ClusterService, wsHub *services.WSHub, logger *logrus.Logger, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runMonitoringTick(ctx, clusterService, wsHub, logger)
		}
	}
}

func runMonitoringTick(ctx context.Context, clusterService *services.ClusterService, wsHub *services.WSHub, logger *logrus.Logger) {
	status, err := clusterService.GetClusterStatus(ctx)
	if err != nil {
		logger.WithError(err).Warn("Failed to get cluster status during monitoring")
		return
	}

	wsHub.Broadcast("cluster_status_updated", status)

	metrics, err := clusterService.GetMetrics(ctx)
	if err != nil {
		logger.WithError(err).Warn("Failed to get cluster metrics during monitoring")
		return
	}

	wsHub.Broadcast("cluster_metrics_updated", metrics)

	logger.WithFields(logrus.Fields{
		"total_nodes":  status.TotalNodes,
		"online_nodes": status.OnlineNodes,
		"uptime":       metrics.Uptime,
	}).Debug("System monitoring update")
}

// CreateDesktopIcon creates a desktop shortcut/icon for the application
func CreateDesktopIcon(cfg *config.Config, logger *logrus.Logger) error {
	logger.Info("Creating desktop icon...")

	// This would create desktop shortcuts based on the platform
	// Implementation would vary by OS

	return fmt.Errorf("desktop icon creation not implemented")
}

// SetupAutoStart configures the application to start automatically
func SetupAutoStart(enable bool, cfg *config.Config, logger *logrus.Logger) error {
	logger.WithField("enable", enable).Info("Configuring auto-start")

	// This would configure auto-start based on the platform
	// Implementation would vary by OS

	return fmt.Errorf("auto-start configuration not implemented")
}
