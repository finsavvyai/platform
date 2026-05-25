package main

import (
	"strings"

	"github.com/finsavvyai/pushci/internal/config"
)

// withDeployOverride is set by `pushci run --with-deploy` when the
// user explicitly wants to execute deploy targets from a local
// run, even when the trigger field would normally gate them.
var withDeployOverride bool

// Deploy trigger values. Kept as string consts so the YAML stays
// human-authoritative.
const (
	triggerPush   = "push"   // only on webhook-dispatched push events
	triggerManual = "manual" // only from `pushci deploy`
	triggerAlways = "always" // run in every context
)

// normalizeTrigger maps the free-form YAML trigger value to the
// canonical internal trigger. v1.4.4 accepts "merge to <branch>"
// as an alias for trigger=push + only_on=[branch], matching how
// GitHub Actions' `on: push` + `branches:` reads to humans. The
// returned onlyOn is a hint the caller can merge into the target's
// existing only_on list.
func normalizeTrigger(raw string) (trigger string, onlyOn []string) {
	t := strings.ToLower(strings.TrimSpace(raw))
	if strings.HasPrefix(t, "merge to ") {
		branch := strings.TrimSpace(strings.TrimPrefix(t, "merge to "))
		if branch == "" {
			return triggerPush, nil
		}
		return triggerPush, []string{branch}
	}
	return t, nil
}

// shouldRunDeployDuringRun decides whether a single deploy target
// should execute during `pushci run`. It honors the target's
// trigger field so developers don't accidentally ship when they
// only wanted to run tests.
//
//	trigger: push     → false (wait for the webhook)
//	trigger: manual   → false (wait for `pushci deploy`)
//	trigger: always   → true
//	trigger: ""       → true (backward-compat default)
//	trigger: merge to X → false (same as push; X merged into only_on)
//
// The force flag overrides the trigger rule. Users opt in via
// `pushci run --with-deploy`.
func shouldRunDeployDuringRun(d *config.DeployTarget, force bool) bool {
	if d == nil {
		return false
	}
	if force {
		return true
	}
	trig, _ := normalizeTrigger(d.Trigger)
	switch trig {
	case triggerPush, triggerManual:
		return false
	}
	return true
}

// deploySkipReason returns the human-readable reason a deploy was
// skipped. Used by the runner to print a clear notice.
func deploySkipReason(d *config.DeployTarget) string {
	if d == nil {
		return ""
	}
	trig, _ := normalizeTrigger(d.Trigger)
	switch trig {
	case triggerPush:
		return "trigger is 'push' — will run when the webhook dispatches"
	case triggerManual:
		return "trigger is 'manual' — run `pushci deploy` when ready"
	}
	return ""
}
