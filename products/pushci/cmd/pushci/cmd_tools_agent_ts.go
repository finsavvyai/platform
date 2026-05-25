package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/observe"
	"github.com/finsavvyai/pushci/internal/runner"
)

func setupTailscale(tsMode runner.TailscaleMode, port, bindAddr string) string {
	tsBin, err := runner.FindTailscaleBinary()
	if err != nil {
		cli.Warn(err.Error())
		cli.Info("Falling back to direct binding")
		return bindAddr
	}
	hostname, ip, _ := runner.TailscaleStatus(tsBin)
	if ip != "" {
		bindAddr = ip + port
		cli.Success(fmt.Sprintf("Tailnet: %s (%s)", hostname, ip))
	}
	switch tsMode {
	case runner.TailscaleServe:
		if err := runner.EnableServe(tsBin, 8484); err != nil {
			cli.Warn("Tailscale Serve: " + err.Error())
		} else {
			cli.Success("Tailscale Serve enabled (private tailnet)")
		}
	case runner.TailscaleFunnel:
		if err := runner.EnableFunnel(tsBin, 8484); err != nil {
			cli.Warn("Tailscale Funnel: " + err.Error())
		} else {
			cli.Success("Tailscale Funnel enabled (public internet)")
		}
	}
	return bindAddr
}

func cmdStatus() error {
	cli.Header("PushCI Status")
	collector := observe.LoadCollector()
	metrics := collector.BuildMetricsSummary()
	cli.Table([]string{"Metric", "Value"}, [][]string{
		{"Total runs", fmt.Sprintf("%d", metrics.TotalRuns)},
		{"Pass rate", fmt.Sprintf("%.1f%%", metrics.PassRate)},
		{"Avg duration", fmt.Sprintf("%.1fs", metrics.AvgDuration.Seconds())},
		{"Cost saved", fmt.Sprintf("$%.2f", metrics.CostSaved)},
	})
	insights := collector.GenerateInsights()
	if len(insights) > 0 {
		fmt.Println()
		cli.Info("Insights:")
		for _, ins := range insights {
			fmt.Printf("  %s [%s] %s\n", cli.Dot(), ins.Category, ins.Message)
		}
	}
	return nil
}
