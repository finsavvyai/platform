package server

import "fmt"

// isSuccessMessage classifies a job_complete event's message. act
// emits "Job succeeded" on pass and "Job failed" on fail.
func isSuccessMessage(msg string) bool {
	for i := 0; i+8 <= len(msg); i++ {
		if msg[i] == 's' || msg[i] == 'S' {
			if equalFold(msg[i:i+9], "succeeded") {
				return true
			}
		}
	}
	return false
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca := a[i]
		cb := b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 32
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 32
		}
		if ca != cb {
			return false
		}
	}
	return true
}

// buildStatusSummary generates the human-readable summary for the
// aggregate "pushci/ci" context and the PR comment body.
func buildStatusSummary(passed bool, exitCode int, posted int) string {
	if passed {
		return fmt.Sprintf(
			"`.github/workflows` ran via PushCI Actions runtime — all jobs passed (%d statuses posted)",
			posted,
		)
	}
	return fmt.Sprintf(
		"`.github/workflows` ran via PushCI Actions runtime — FAILED (exit %d, %d job statuses posted)",
		exitCode, posted,
	)
}
