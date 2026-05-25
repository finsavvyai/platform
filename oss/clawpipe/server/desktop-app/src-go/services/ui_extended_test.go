package services

import (
	"runtime"
	"testing"

	"finsavvyai-desktop/config"

	"github.com/sirupsen/logrus"
)

func TestShowNotification_AllUrgencies(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	urgencies := []string{"low", "normal", "critical"}
	for _, u := range urgencies {
		t.Run(u, func(t *testing.T) {
			// Should not panic regardless of urgency
			_ = svc.ShowNotification("Title", "Body", u)
		})
	}
}

func TestShowNotification_EmptyStrings(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	// Should not panic with empty strings
	_ = svc.ShowNotification("", "", "")
}

func TestShowMacNotification(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("skipping Mac notification test on non-Darwin")
	}
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	// Direct call to platform method
	_ = svc.showMacNotification("Test", "message", "low")
}

func TestShowLinuxNotification(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	// Will fail on non-Linux (notify-send not found) but should not panic
	_ = svc.showLinuxNotification("Test", "message", "low")
}

func TestShowWindowsNotification(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	// Windows notification just logs, should return nil
	err := svc.showWindowsNotification("Test", "message", "normal")
	if err != nil {
		t.Errorf("showWindowsNotification returned error: %v", err)
	}
}

func TestOpenURL_CurrentPlatform(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	// Test with a safe URL that won't actually open anything meaningful
	_ = svc.OpenURL("http://127.0.0.1:1/nonexistent")
}

func TestGetSystemInfo_AllFields(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	info := svc.GetSystemInfo()

	// Verify platform matches runtime
	if info["platform"] != runtime.GOOS {
		t.Errorf("platform = %v, want %v", info["platform"], runtime.GOOS)
	}
	if info["arch"] != runtime.GOARCH {
		t.Errorf("arch = %v, want %v", info["arch"], runtime.GOARCH)
	}

	// Verify memory map has all expected sub-keys
	memMap, ok := info["memory"].(map[string]interface{})
	if !ok {
		t.Fatal("memory not a map")
	}

	for _, key := range []string{"alloc", "total_alloc", "sys", "num_gc"} {
		if _, exists := memMap[key]; !exists {
			t.Errorf("missing memory key: %s", key)
		}
	}

	// Verify numeric fields are positive
	if goroutines, ok := info["goroutines"].(int); !ok || goroutines < 1 {
		t.Errorf("goroutines = %v", info["goroutines"])
	}
	if cpus, ok := info["cpu_count"].(int); !ok || cpus < 1 {
		t.Errorf("cpu_count = %v", info["cpu_count"])
	}
}
