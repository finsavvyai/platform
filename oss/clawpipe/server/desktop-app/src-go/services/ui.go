package services

import (
	"fmt"
	"os/exec"
	"runtime"

	"finsavvyai-desktop/config"

	"github.com/sirupsen/logrus"
)

type UIService struct {
	config *config.Config
	logger *logrus.Logger
}

func NewUIService(cfg *config.Config, logger *logrus.Logger) *UIService {
	return &UIService{
		config: cfg,
		logger: logger,
	}
}

func (u *UIService) ShowNotification(title, message string, urgency string) error {
	switch runtime.GOOS {
	case "darwin":
		return u.showMacNotification(title, message, urgency)
	case "linux":
		return u.showLinuxNotification(title, message, urgency)
	case "windows":
		return u.showWindowsNotification(title, message, urgency)
	default:
		u.logger.WithField("os", runtime.GOOS).Warn("Notifications not supported on this platform")
		return nil
	}
}

func (u *UIService) showMacNotification(title, message, urgency string) error {
	cmd := exec.Command("osascript", "-e", fmt.Sprintf(`
		display notification "%s" with title "%s" subtitle "FinSavvyAI"
	`, message, title))

	return cmd.Run()
}

func (u *UIService) showLinuxNotification(title, message, urgency string) error {
	cmd := exec.Command("notify-send",
		"--app-name", "FinSavvyAI",
		"--urgency", urgency,
		title, message)

	return cmd.Run()
}

func (u *UIService) showWindowsNotification(title, message, urgency string) error {
	// Windows notifications would require additional setup
	// For now, just log the notification
	u.logger.WithFields(logrus.Fields{
		"title":   title,
		"message": message,
		"urgency": urgency,
	}).Info("Windows notification (not implemented)")
	return nil
}

func (u *UIService) OpenURL(url string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	return cmd.Start()
}

func (u *UIService) GetSystemInfo() map[string]interface{} {
	info := make(map[string]interface{})

	info["platform"] = runtime.GOOS
	info["arch"] = runtime.GOARCH
	info["go_version"] = runtime.Version()

	// Get memory info (simplified)
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	info["memory"] = map[string]interface{}{
		"alloc":       m.Alloc,
		"total_alloc": m.TotalAlloc,
		"sys":         m.Sys,
		"num_gc":      m.NumGC,
	}

	info["goroutines"] = runtime.NumGoroutine()
	info["cpu_count"] = runtime.NumCPU()

	return info
}
