package ui

import (
	"testing"

	"finsavvyai-desktop/config"
	"finsavvyai-desktop/services"

	"github.com/sirupsen/logrus"
)

func newTestLogger() *logrus.Logger {
	l := logrus.New()
	l.SetLevel(logrus.ErrorLevel)
	return l
}

func TestInitialize_WithNotifications(t *testing.T) {
	cfg := config.Default()
	cfg.UI.ShowNotifications = true
	logger := newTestLogger()

	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	// Should not panic with notifications enabled
	Initialize(cfg, logger, clusterSvc, hub)
}

func TestInitialize_WithoutNotifications(t *testing.T) {
	cfg := config.Default()
	cfg.UI.ShowNotifications = false
	logger := newTestLogger()

	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	Initialize(cfg, logger, clusterSvc, hub)
}

func TestCreateDesktopIcon_ReturnsError(t *testing.T) {
	cfg := config.Default()
	logger := newTestLogger()

	err := CreateDesktopIcon(cfg, logger)
	if err == nil {
		t.Error("expected 'not implemented' error")
	}
	if err.Error() != "desktop icon creation not implemented" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestSetupAutoStart_EnableReturnsError(t *testing.T) {
	cfg := config.Default()
	logger := newTestLogger()

	err := SetupAutoStart(true, cfg, logger)
	if err == nil {
		t.Error("expected 'not implemented' error")
	}
	if err.Error() != "auto-start configuration not implemented" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestSetupAutoStart_DisableReturnsError(t *testing.T) {
	cfg := config.Default()
	logger := newTestLogger()

	err := SetupAutoStart(false, cfg, logger)
	if err == nil {
		t.Error("expected 'not implemented' error")
	}
}

func TestInitialize_MultipleConfigs(t *testing.T) {
	tests := []struct {
		name          string
		notifications bool
		theme         string
	}{
		{"dark_with_notif", true, "dark"},
		{"light_no_notif", false, "light"},
		{"dark_no_notif", false, "dark"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := config.Default()
			cfg.UI.ShowNotifications = tt.notifications
			cfg.UI.Theme = tt.theme
			logger := newTestLogger()

			clusterSvc := services.NewClusterService(cfg, logger)
			hub := services.NewWSHub(logger)
			go hub.Run()

			Initialize(cfg, logger, clusterSvc, hub)
		})
	}
}
