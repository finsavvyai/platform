package main

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// attachAntDeploys copies the migrator's AntDeployTarget list onto
// pipe.Deploys as config.DeployTarget entries. Only runs when the
// pipeline doesn't already have a deploy block — never clobber a
// user-authored (or earlier-migrator-authored) deploy. Kept as its
// own file so cmd_init_ant.go stays under the 100-line CI cap.
func attachAntDeploys(pipe *config.Pipeline, deploys []migrate.AntDeployTarget) {
	if pipe == nil || len(deploys) == 0 || len(pipe.Deploys) > 0 {
		return
	}
	for _, d := range deploys {
		pipe.Deploys = append(pipe.Deploys, config.DeployTarget{
			Name:    d.Name,
			Run:     d.Run,
			OnlyOn:  d.OnlyOn,
			Trigger: d.Trigger,
		})
	}
}
