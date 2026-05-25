package services

import (
	"runtime"
	"testing"

	"finsavvyai-desktop/config"

	"github.com/sirupsen/logrus"
)

func TestNewUIService(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	svc := NewUIService(cfg, logger)
	if svc == nil {
		t.Fatal("NewUIService returned nil")
	}
	if svc.config != cfg {
		t.Error("config not set correctly")
	}
	if svc.logger != logger {
		t.Error("logger not set correctly")
	}
}

func TestGetSystemInfo(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	info := svc.GetSystemInfo()

	expectedKeys := []string{"platform", "arch", "go_version", "memory", "goroutines", "cpu_count"}
	for _, key := range expectedKeys {
		if _, ok := info[key]; !ok {
			t.Errorf("missing expected key %q in system info", key)
		}
	}

	if info["platform"] != runtime.GOOS {
		t.Errorf("platform = %v, want %v", info["platform"], runtime.GOOS)
	}
	if info["arch"] != runtime.GOARCH {
		t.Errorf("arch = %v, want %v", info["arch"], runtime.GOARCH)
	}
	if info["go_version"] != runtime.Version() {
		t.Errorf("go_version = %v, want %v", info["go_version"], runtime.Version())
	}

	cpuCount, ok := info["cpu_count"].(int)
	if !ok || cpuCount < 1 {
		t.Errorf("cpu_count = %v, expected positive int", info["cpu_count"])
	}

	goroutines, ok := info["goroutines"].(int)
	if !ok || goroutines < 1 {
		t.Errorf("goroutines = %v, expected positive int", info["goroutines"])
	}

	memMap, ok := info["memory"].(map[string]interface{})
	if !ok {
		t.Fatal("memory is not a map")
	}

	memKeys := []string{"alloc", "total_alloc", "sys", "num_gc"}
	for _, key := range memKeys {
		if _, ok := memMap[key]; !ok {
			t.Errorf("missing memory key %q", key)
		}
	}
}

func TestShowNotification_DoesNotPanic(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	// This may fail on some platforms but should never panic
	_ = svc.ShowNotification("Test", "message", "low")
}

func TestGetSystemInfo_MemoryValues(t *testing.T) {
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	info := svc.GetSystemInfo()
	memMap := info["memory"].(map[string]interface{})

	alloc, ok := memMap["alloc"].(uint64)
	if !ok {
		t.Fatal("alloc is not uint64")
	}
	if alloc == 0 {
		t.Error("alloc should be > 0")
	}

	sys, ok := memMap["sys"].(uint64)
	if !ok {
		t.Fatal("sys is not uint64")
	}
	if sys == 0 {
		t.Error("sys should be > 0")
	}
}

func TestOpenURL_UnsupportedPlatform(t *testing.T) {
	// We can't easily test unsupported platform, but we can call
	// it and ensure it doesn't crash for the current platform.
	cfg := config.Default()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)
	svc := NewUIService(cfg, logger)

	// OpenURL starts a background process, so we don't test the
	// actual URL opening; just ensure it doesn't panic.
	// Using an invalid URL to avoid actually opening a browser.
	_ = svc.OpenURL("http://localhost:99999/nonexistent")
}
