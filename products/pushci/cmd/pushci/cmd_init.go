package main

import (
	"context"
	"fmt"
	"os"

	"gopkg.in/yaml.v3"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

func cmdInit(ctx context.Context) error {
	if wantsHelp(os.Args[2:]) {
		printInitHelp()
		return nil
	}
	if err := validateFlags("init", os.Args[2:], initFlagSpecs()); err != nil {
		return err
	}
	root, _ := os.Getwd()
	cli.Header("PushCI Init")

	// Never silently clobber a hand-crafted pushci.yml (opensyber).
	if guarded, err := guardExistingPushciYml(root); err != nil {
		return err
	} else if guarded {
		return nil
	}
	sp := cli.NewSpinner()
	sp.Start("Detecting stack...")
	projects := detect.Scan(root)
	sp.Stop(len(projects) > 0)

	// Opt-in hook install (teddk bug #4): users must pass --install-hooks.
	if hasFlag(os.Args[2:], "--install-hooks") {
		installGitHook(root)
	}
	src := pickMigrationSource(root)
	migratedPipe := src.Pipeline
	if len(projects) == 0 && migratedPipe == nil {
		cli.Warn("No supported stack detected.")
		cli.Info("Create a pushci.yml manually or run: pushci generate")
		return nil
	}
	projects = pickProjectsInteractive(projects)
	printDetectedProjects(root, projects)
	deployTargets := detect.ScanDeployTargets(root)
	deployTargets = mergeMigrationDeployHints(deployTargets, src.DeployHints)
	if len(deployTargets) == 0 && detect.AmbiguousDeploy(detect.RankDeployTargets(root)) {
		cli.Warn("No clear deploy target — specify with `pushci init --deploy=<target>`")
	}
	printDeployTargets(deployTargets)

	// TF pipeline: aws_codepipeline / cloudbuild_trigger overrides
	// filename deploy heuristic.
	tfHints := consumeTerraformPipelines(root)
	printTFPipelineBanner(tfHints)

	var pipe *config.Pipeline
	if migratedPipe != nil {
		pipe = migratedPipe
		mergeSecondaryHeuristic(pipe, src, root, projects, deployTargets)
	} else {
		pipe = generatePipeline(root, projects, deployTargets)
	}
	// Migrated pipelines come from foreign CI formats that have CI
	// stages but no PushCI-style deploy targets; merge ours in.
	if migratedPipe != nil && len(pipe.Deploys) == 0 {
		pipe.Deploys = resolveDeployTarget(deployTargets)
	}
	if tfHints != nil && len(tfHints.Deploys) > 0 {
		pipe.Deploys = tfHints.Deploys
	}
	// Stage runner is sequential — sort topologically so depends_on
	// fires before dependents. GitHub Actions runs jobs parallel via
	// needs: and our stage preservation can break ordering otherwise.
	pipe.Stages = topoSortStages(pipe.Stages)
	// Skip AI "optimization" for workspace-aware pipelines; the
	// AI path regenerates from scratch and clobbers turbo stages.
	ws := detect.DetectWorkspace(root)
	if !ws.IsWorkspace && !ws.IsTurbo && migratedPipe == nil {
		pipe = aiOptimizePreservingDeploys(ctx, sp, projects, pipe)
	}

	out, err := yaml.Marshal(pipe)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	out = prependMigrationHeader(out, src, version)
	if err := os.WriteFile(root+"/pushci.yml", out, 0644); err != nil {
		return fmt.Errorf("write pushci.yml: %w", err)
	}
	finishInit(pipe, projects)
	return nil
}
