package main

import (
	"log"
	"strings"
	"sync"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/notify"
	"github.com/finsavvyai/pushci/internal/runner"
)

// sendNotifications sends run results to all configured channels.
// Errors are logged but never fail the build.
func sendNotifications(pipe *config.Pipeline, run *runner.Run, root string) {
	if pipe == nil || pipe.Notify == nil {
		return
	}
	event := buildNotifyEvent(run, root)
	dispatchNotifications(pipe.Notify, event)
}

// sendPipelineNotifications sends stage-based results to channels.
func sendPipelineNotifications(pipe *config.Pipeline, passed bool, elapsed time.Duration, root string) {
	if pipe == nil || pipe.Notify == nil {
		return
	}
	status := notify.StatusPassed
	if !passed {
		status = notify.StatusFailed
	}
	event := notify.NotifyEvent{
		Repo: gitRemoteRepo(), Branch: gitBranch(root),
		Status: status, Duration: elapsed.String(),
	}
	dispatchNotifications(pipe.Notify, event)
}

func dispatchNotifications(nc *config.NotifyConfig, event notify.NotifyEvent) {
	notifiers := buildNotifiers(nc)
	if len(notifiers) == 0 {
		return
	}
	var wg sync.WaitGroup
	for name, n := range notifiers {
		wg.Add(1)
		go func(label string, sender notify.Notifier) {
			defer wg.Done()
			if err := sender.Send(event); err != nil {
				log.Printf("[notify] %s: %v", label, err)
			}
		}(name, n)
	}
	wg.Wait()
	cli.Info("Notifications sent")
}

func buildNotifiers(nc *config.NotifyConfig) map[string]notify.Notifier {
	out := map[string]notify.Notifier{}
	if nc.Slack != "" {
		out["slack"] = notify.NewSlackNotifier(nc.Slack)
	}
	if nc.Discord != "" {
		out["discord"] = notify.NewDiscordNotifier(nc.Discord)
	}
	if nc.Telegram != "" {
		parts := strings.SplitN(nc.Telegram, ":", 2)
		if len(parts) == 2 {
			out["telegram"] = notify.NewTelegramNotifier(parts[0], parts[1])
		}
	}
	if nc.Webhook != "" {
		out["webhook"] = notify.NewWebhookNotifier(nc.Webhook)
	}
	return out
}

func buildNotifyEvent(run *runner.Run, root string) notify.NotifyEvent {
	status := notify.StatusPassed
	if !run.Passed {
		status = notify.StatusFailed
	}
	var checks []notify.CheckResult
	for _, r := range run.Results {
		cs := notify.StatusPassed
		if !r.Passed {
			cs = notify.StatusFailed
		}
		checks = append(checks, notify.CheckResult{
			Name: r.Check, Status: cs, Duration: r.Duration.String(),
		})
	}
	return notify.NotifyEvent{
		Repo: gitRemoteRepo(), Branch: gitBranch(root),
		Status: status, Duration: run.Elapsed.String(),
		Checks: checks,
	}
}
