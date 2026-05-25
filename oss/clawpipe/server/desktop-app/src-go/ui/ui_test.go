package ui

import (
	"testing"

	"finsavvyai-desktop/config"
	"finsavvyai-desktop/services"

	"github.com/sirupsen/logrus"
)

func TestCreateDesktopIcon(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	err := CreateDesktopIcon(cfg, logger)
	if err == nil {
		t.Error("CreateDesktopIcon expected 'not implemented' error, got nil")
	}
}

func TestSetupAutoStart_Enable(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	err := SetupAutoStart(true, cfg, logger)
	if err == nil {
		t.Error("SetupAutoStart expected 'not implemented' error, got nil")
	}
}

func TestSetupAutoStart_Disable(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	err := SetupAutoStart(false, cfg, logger)
	if err == nil {
		t.Error("SetupAutoStart expected 'not implemented' error, got nil")
	}
}

func TestInitialize_DoesNotPanic(t *testing.T) {
	cfg := config.Default()
	cfg.UI.ShowNotifications = false // Avoid OS notification side effects
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	// Initialize should not panic
	Initialize(cfg, logger, clusterSvc, hub)
}
