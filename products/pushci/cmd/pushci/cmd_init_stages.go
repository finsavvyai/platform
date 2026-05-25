package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// buildSingleProjectStages creates stages when all projects share one dir.
// Stages without checks are omitted so we never emit a `- name: test`
// bucket that silently runs the BSD `test` utility.
func buildSingleProjectStages(root string, stacks map[detect.Stack]bool, projects []detect.Project, dir string) []config.Stage {
	installCmds := buildInstallCommandsForProjects(root, stacks, projects)
	buildChecks, testChecks, lintChecks := buildCheckCommands(root, stacks, projects)
	stages := []config.Stage{
		{Name: "install", Dir: dir, Checks: installChecksFromCmds(installCmds)},
	}
	if len(buildChecks) > 0 {
		stages = append(stages, config.Stage{Name: "build", Dir: dir, DependsOn: []string{"install"}, Checks: buildChecks})
	}
	if len(testChecks) > 0 {
		stages = append(stages, config.Stage{Name: "test", Dir: dir, DependsOn: []string{"install"}, Parallel: true, Checks: testChecks})
	}
	if len(lintChecks) > 0 {
		stages = append(stages, config.Stage{Name: "lint", Dir: dir, DependsOn: []string{"install"}, Parallel: true, Checks: lintChecks})
	}
	return stages
}

// buildMonorepoStages creates per-project stages for multi-dir repos.
func buildMonorepoStages(root string, projects []detect.Project) []config.Stage {
	var stages []config.Stage
	for _, p := range projects {
		if p.Stack == detect.Docker {
			continue
		}
		sub := projectStages(root, p)
		stages = append(stages, sub...)
	}
	return stages
}

// projectStages returns install/build/test/lint stages for one sub-project.
func projectStages(root string, p detect.Project) []config.Stage {
	stacks := map[detect.Stack]bool{p.Stack: true}
	projects := []detect.Project{p}
	dir := p.Dir
	if dir == "." {
		dir = ""
	}

	prefix := dir
	if prefix == "" {
		prefix = string(p.Stack)
	}
	installName := fmt.Sprintf("%s-install", prefix)

	installCmds := buildInstallCommandsForProjects(root, stacks, projects)
	buildChecks, testChecks, lintChecks := buildCheckCommands(root, stacks, projects)

	var stages []config.Stage
	stages = append(stages, config.Stage{
		Name: installName, Dir: dir, Checks: installChecksFromCmds(installCmds),
	})
	if len(buildChecks) > 0 {
		stages = append(stages, config.Stage{
			Name: prefix + "-build", Dir: dir, DependsOn: []string{installName}, Checks: buildChecks,
		})
	}
	if len(testChecks) > 0 {
		stages = append(stages, config.Stage{
			Name: prefix + "-test", Dir: dir, DependsOn: []string{installName}, Parallel: true, Checks: testChecks,
		})
	}
	if len(lintChecks) > 0 {
		stages = append(stages, config.Stage{
			Name: prefix + "-lint", Dir: dir, DependsOn: []string{installName}, Parallel: true, Checks: lintChecks,
		})
	}
	return stages
}
