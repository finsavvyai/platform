package migrate

import (
	"fmt"
	"strings"
)

// DroneConvertResult holds the migration output for a .drone.yml file.
type DroneConvertResult struct {
	PushCIYAML     string
	PipelinesFound int
	StepsKept      int
	StepsRemoved   int
	Warnings       []string
	EnvVarsNeeded  []EnvVarRef
}

// ConvertDrone converts a .drone.yml (multi-document) to PushCI format.
// Drone pipelines are a sequence of YAML documents separated by `---`,
// each with kind: pipeline and a list of steps.
func ConvertDrone(rawYAML string) *DroneConvertResult {
	result := &DroneConvertResult{}

	pipelines, err := parseDroneDocs([]byte(rawYAML))
	if err != nil {
		result.Warnings = append(result.Warnings,
			"Failed to parse .drone.yml: "+err.Error())
		return result
	}
	if len(pipelines) == 0 {
		result.Warnings = append(result.Warnings,
			"No kind: pipeline documents found in .drone.yml")
		return result
	}

	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")

	multi := len(pipelines) > 1
	for _, p := range pipelines {
		convertDronePipeline(p, multi, &b, result)
	}

	result.PushCIYAML = b.String()
	return result
}

func convertDronePipeline(p dronePipeline, multi bool, b *strings.Builder, r *DroneConvertResult) {
	if p.Kind != "" && p.Kind != "pipeline" {
		return
	}
	if t := strings.ToLower(p.Type); t != "" && t != "docker" {
		r.Warnings = append(r.Warnings, fmt.Sprintf(
			"Pipeline '%s' uses type: %s — not supported, only type: docker maps cleanly",
			p.Name, p.Type))
		return
	}
	warnDroneTopLevel(p, r)
	r.PipelinesFound++

	prefix := ""
	if multi && p.Name != "" {
		prefix = sanitizeName(p.Name) + "-"
	}
	for _, step := range p.Steps {
		convertDroneStep(step, prefix, p, b, r)
	}
}

func warnDroneTopLevel(p dronePipeline, r *DroneConvertResult) {
	if len(p.Services) > 0 {
		names := make([]string, 0, len(p.Services))
		for _, s := range p.Services {
			names = append(names, s.Name)
		}
		r.Warnings = append(r.Warnings, fmt.Sprintf(
			"Pipeline '%s': services [%s] — PushCI does not auto-start sidecars, "+
				"start them locally or via docker-compose",
			p.Name, strings.Join(names, ",")))
	}
	if len(p.Trigger) > 0 {
		r.Warnings = append(r.Warnings, fmt.Sprintf(
			"Pipeline '%s': trigger block dropped — configure triggers in pushci.yml 'on:'",
			p.Name))
	}
}
