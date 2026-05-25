package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// runMigration dispatches to the foreign-CI converter for `kind`
// and returns the four pieces every migrator produces: the
// generated YAML, env-var references, deploy hints, and warnings.
// Per-kind result types vary, so the dispatch table is the only
// place that knows about the union shape.
func runMigration(data, kind, name string) (string, []migrate.EnvVarRef, []migrate.DeployHint, []string) {
	switch kind {
	case "gitlab":
		r := migrate.ConvertGitLab(data)
		cli.Success(fmt.Sprintf("Migrated %d stages, %d jobs from %s", r.StagesConverted, r.JobsConverted, name))
		return r.PushCIYAML, r.EnvVarsNeeded, r.DeployHints, r.Warnings
	case "circleci":
		r := migrate.ConvertCircleCI(data)
		cli.Success(fmt.Sprintf("Migrated %d jobs, %d steps from %s", r.JobsConverted, r.StepsKept, name))
		return r.PushCIYAML, r.EnvVarsNeeded, nil, r.Warnings
	case "jenkins":
		r := migrate.ConvertJenkinsfile(data)
		cli.Success(fmt.Sprintf("Migrated %d stages, %d steps from %s", r.StagesConverted, r.StepsKept, name))
		return r.PushCIYAML, r.EnvVarsNeeded, nil, r.Warnings
	case "bitbucket":
		r := migrate.ConvertBitbucket(data)
		cli.Success(fmt.Sprintf("Migrated %d pipelines, %d steps from %s", r.PipelinesFound, r.StepsKept, name))
		return r.PushCIYAML, r.EnvVarsNeeded, nil, r.Warnings
	case "azure":
		r := migrate.ConvertAzurePipelines(data)
		cli.Success(fmt.Sprintf("Migrated %d stages, %d steps from %s", r.StagesConverted, r.StepsKept, name))
		return r.PushCIYAML, r.EnvVarsNeeded, nil, r.Warnings
	case "github":
		r := migrate.ConvertActions(migrate.ActionsWorkflow{RawYAML: data})
		cli.Success(fmt.Sprintf("Migrated %d steps from %s", r.StepsKept, name))
		return r.PushCIYAML, r.EnvVarsNeeded, nil, r.Warnings
	}
	return "", nil, nil, nil
}
