package main

import (
	"context"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/deploy"
)

func cmdDeploy(ctx context.Context, args []string) error {
	if wantsHelp(args) {
		printSubUsage("deploy",
			"pushci deploy <target> [--stage staging|production]",
			"Deploy your application to a target environment.",
			[][2]string{
				{"--stage, -s <name>", "deploy stage (staging, production, ...)"},
			},
			[]string{
				"pushci deploy cloudflare-pages",
				"pushci deploy aws-ecs --stage production",
				"pushci deploy vercel",
			})
		fmt.Println(cli.Bold("Targets:"))
		fmt.Println("  " + cli.Dim(
			"cloudflare-pages, cloudflare-workers, aws-ecs, aws-lambda, "+
				"aws-s3, gcp-cloud-run, gcp-app-engine, azure-app-service, "+
				"docker, kubernetes, vercel, railway, fly, render, netlify, "+
				"ssh, terraform, cloudformation, pulumi, ansible",
		))
		return nil
	}
	if len(args) == 0 {
		cli.Error("Usage: pushci deploy <target> [--stage staging|production]")
		fmt.Println("\nTargets: " + cli.Dim(
			"cloudflare-pages, cloudflare-workers, aws-ecs, aws-lambda, "+
				"aws-s3, gcp-cloud-run, gcp-app-engine, azure-app-service, "+
				"docker, kubernetes, vercel, railway, fly, render, netlify, "+
				"ssh, terraform, cloudformation, pulumi, ansible",
		))
		return fmt.Errorf("target required")
	}
	if err := validateFlags("deploy", args[1:], deployFlagSpecs()); err != nil {
		return err
	}

	root, _ := os.Getwd()
	alias := args[0]
	target := deploy.Target(alias)
	stage := flagValue(args, "--stage", "-s")

	cli.Header("PushCI Deploy")

	env := collectEnv()

	if quickstartTargets[alias] {
		resolved, extraEnv, err := quickstartPreflight(alias, root)
		if err != nil {
			return err
		}
		target = resolved
		for k, v := range extraEnv {
			if _, set := env[k]; !set {
				env[k] = v
			}
		}
	}

	if stage != "" {
		sp := cli.NewSpinner()
		sp.Start(fmt.Sprintf("Deploying to %s (%s)...", target, stage))
		result, err := deploy.StagedDeploy(ctx, root, env, target)
		sp.Stop(err == nil && result.Deploy.Success)

		if err != nil {
			return fmt.Errorf("deploy failed: %w", err)
		}
		if !result.Deploy.Success {
			cli.Error(result.Deploy.Output)
			return fmt.Errorf("deploy failed")
		}

		cli.Success(fmt.Sprintf("Deployed to %s → %s", stage, result.PreviewURL))
		return nil
	}

	return runDeployOnce(ctx, target, root, env, alias)
}

// collectEnv, splitEnv, deployFlagSpecs, flagValue live in cmd_deploy_env.go.
// runDeployOnce + success-message branching live in cmd_deploy_success.go.
