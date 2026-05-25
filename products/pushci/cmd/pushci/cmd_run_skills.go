package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/skill"
)

func filterAffectedProjects(root string, projects []detect.Project) []detect.Project {
	affected, err := detect.AffectedPackages(root, "")
	if err == nil && len(affected) > 0 {
		var filtered []detect.Project
		for _, p := range projects {
			for _, a := range affected {
				if p.Dir == a || strings.HasPrefix(p.Dir, a+"/") {
					filtered = append(filtered, p)
					break
				}
			}
		}
		if len(filtered) > 0 {
			cli.Info(fmt.Sprintf("Monorepo: %d/%d packages affected", len(filtered), len(projects)))
			return filtered
		}
	}
	return projects
}

func runInstalledSkills(ctx context.Context, root string) bool {
	steps, err := skill.LoadInstalledSteps(root)
	if err != nil || len(steps) == 0 {
		return false
	}

	fmt.Println()
	cli.Info(fmt.Sprintf("Running %d installed skill step(s)...", len(steps)))

	// Best-effort telemetry: one invoke event per skill id (opt-in).
	reported := map[string]bool{}
	token := ""
	if cfg := loadConfig(); cfg != nil {
		token = cfg.Token
	}

	anyFailed := false
	for _, s := range steps {
		if !reported[s.SkillID] {
			skill.ReportInvocation(s.SkillID, token)
			reported[s.SkillID] = true
		}
		start := time.Now()
		result := runShellCmd(ctx, root, s.Command, nil)
		dur := time.Since(start).Truncate(time.Millisecond)
		if result.passed {
			fmt.Printf("  %s %s %s\n", cli.CheckMark(), s.FormatStepLabel(), cli.Dim(dur.String()))
		} else {
			fmt.Printf("  %s %s %s\n", cli.CrossMark(), cli.Red(s.FormatStepLabel()), cli.Dim(dur.String()))
			lines := lastLines(result.output, 2)
			for _, l := range lines {
				fmt.Printf("    %s\n", cli.Dim(l))
			}
			if s.OnFail == "block" {
				anyFailed = true
			}
		}
	}
	return anyFailed
}

func pipelineHasOperators(pipe *config.Pipeline) bool {
	for _, s := range pipe.Stages {
		if s.Retry > 0 || len(s.OnFailure) > 0 || s.OnSuccess || s.Approve || s.Timeout != "" {
			return true
		}
		for _, c := range s.Checks {
			if c.Retry > 0 || c.OnFail != "" || c.If != "" {
				return true
			}
		}
	}
	return false
}
