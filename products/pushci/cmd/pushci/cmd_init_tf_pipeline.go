package main

import (
	"path/filepath"
	"sort"
	"strings"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// tfPipelineHints is the result of consuming Terraform pipeline
// resources in the repo. When non-nil, fields override the filename-
// heuristic deploy target and pipeline project name.
type tfPipelineHints struct {
	Deploys  []config.DeployTarget
	EnvVars  []migrate.EnvVarRef
	Project  string // first extracted pipeline Name
	Platform string // "aws-ecs", "aws-s3", "aws-codedeploy", etc.
	Stages   int    // total codepipeline stages (for banner)
}

// consumeTerraformPipelines scans for ci:*-tf markers, runs the TF
// migrator on each unique directory, and condenses the result into a
// deploy-target hint. Returns nil when no TF pipelines are present.
func consumeTerraformPipelines(root string) *tfPipelineHints {
	providers := detect.ScanCIProviders(root)
	dirs := tfPipelineDirs(root, providers)
	if len(dirs) == 0 {
		return nil
	}
	hints := &tfPipelineHints{}
	for _, dir := range dirs {
		r := migrate.ConvertTerraformPipeline(dir)
		for _, p := range r.Pipelines {
			if hints.Project == "" {
				hints.Project = p.Name
			}
			hints.Stages += len(p.Stages)
			// Prefer the most specific deploy action across all
			// pipelines. An `aws_codebuild_project` co-located with
			// an ECS `aws_codepipeline` is a build step FOR the ECS
			// deploy, not a standalone target.
			if got := mapTFPipelineToDeploy(&p); platformRank(got) > platformRank(hints.Platform) {
				hints.Platform = got
			}
		}
		hints.EnvVars = append(hints.EnvVars, r.EnvVarsNeeded...)
	}
	if hints.Platform == "" {
		return hints
	}
	hints.Deploys = buildTFDeploy(hints.Platform, hints.Project)
	return hints
}

// tfPipelineDirs returns unique directories that contain at least one
// *-tf CI marker, deduped by filepath.Dir on the ConfigFile.
func tfPipelineDirs(root string, providers []detect.CIProvider) []string {
	seen := map[string]bool{}
	var out []string
	for _, p := range providers {
		if !strings.HasSuffix(p.Marker, "-tf") {
			continue
		}
		d := filepath.Join(root, filepath.Dir(p.ConfigFile))
		if seen[d] {
			continue
		}
		seen[d] = true
		out = append(out, d)
	}
	sort.Strings(out)
	return out
}
