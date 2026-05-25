package runner

import (
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
)

// PrintStressReport outputs a formatted table of stress test results.
func PrintStressReport(results []StressResult) {
	cli.Header("Stress Test Report")

	headers := []string{"Check", "Runs", "Pass", "Fail", "Flake%", "Avg Time"}
	rows := buildStressRows(results)
	cli.Table(headers, rows)

	flaky, total := countFlaky(results)
	fmt.Println()
	printFlakySummary(flaky, total)
}

func buildStressRows(results []StressResult) [][]string {
	var rows [][]string
	for _, r := range results {
		pct := fmt.Sprintf("%.1f%%", r.FlakeRate*100)
		pct = colorFlakeRate(pct, r.FlakeRate)
		avg := r.AvgDuration.Truncate(time.Millisecond).String()
		rows = append(rows, []string{
			r.CheckName,
			fmt.Sprintf("%d", r.Runs),
			fmt.Sprintf("%d", r.Passes),
			fmt.Sprintf("%d", r.Fails),
			pct,
			avg,
		})
	}
	return rows
}

func colorFlakeRate(s string, rate float64) string {
	if rate == 0 {
		return cli.Green(s)
	}
	if rate < 0.1 {
		return cli.Yellow(s)
	}
	return cli.Red(s)
}

func countFlaky(results []StressResult) (int, int) {
	flaky := 0
	for _, r := range results {
		if r.FlakeRate > 0 {
			flaky++
		}
	}
	return flaky, len(results)
}

func printFlakySummary(flaky, total int) {
	msg := fmt.Sprintf("%d of %d checks are flaky", flaky, total)
	if flaky == 0 {
		cli.Success(msg)
	} else {
		cli.Warn(msg)
	}
}
