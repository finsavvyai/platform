package main

import (
	"strings"

	"github.com/finsavvyai/pushci/internal/migrate"
)

// mapTFPipelineToDeploy picks the best PushCI deploy platform for a
// pipeline based on its action providers. ECS → aws-ecs, S3 → aws-s3,
// CodeDeploy → aws-codedeploy. CodeBuild pipelines fall back to
// aws-codebuild only when no CodePipeline is present.
func mapTFPipelineToDeploy(p *migrate.ExtractedPipeline) string {
	if p.Platform == "aws-codebuild" {
		return "aws-codebuild"
	}
	for _, s := range p.Stages {
		switch strings.ToUpper(s.Provider) {
		case "ECS":
			return "aws-ecs"
		case "CODEDEPLOY":
			return "aws-codedeploy"
		case "S3":
			if strings.ToLower(s.Name) != "source" {
				return "aws-s3"
			}
		}
	}
	return ""
}

// platformRank orders deploy platforms so ECS/CodeDeploy/S3 outrank
// aws-codebuild, which outranks an empty string. Used to pick the
// most specific TF-derived deploy target across multiple extracted
// pipelines (codebuild + codepipeline in the same dir is typical).
func platformRank(p string) int {
	switch p {
	case "aws-ecs", "aws-codedeploy":
		return 3
	case "aws-s3":
		return 2
	case "aws-codebuild":
		return 1
	}
	return 0
}
