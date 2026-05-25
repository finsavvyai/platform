package main

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// ext4CheckCommands returns build/test/lint for Terraform, Helm, Solidity, Bun, Fortran.
func ext4CheckCommands(stacks map[detect.Stack]bool, projects []detect.Project) (build, test, lint []config.Check) {
	if stacks[detect.Terraform] {
		build = append(build, config.Check{Name: "tf-plan", Run: "terraform plan"})
		test = append(test, config.Check{Name: "tf-validate", Run: "terraform validate"})
		lint = append(lint, config.Check{Name: "tf-fmt", Run: "terraform fmt -check"})
	}
	if stacks[detect.Helm] {
		build = append(build, config.Check{Name: "helm-package", Run: "helm package ."})
		test = append(test, config.Check{Name: "helm-lint", Run: "helm lint ."})
	}
	if stacks[detect.Solidity] {
		sb, st, sl := solidityCheckCommands(projects)
		build = append(build, sb...)
		test = append(test, st...)
		lint = append(lint, sl...)
	}
	if stacks[detect.Bun] {
		build = append(build, config.Check{Name: "bun-build", Run: "bun run build"})
		test = append(test, config.Check{Name: "bun-test", Run: "bun test"})
		lint = append(lint, config.Check{Name: "bun-lint", Run: "bun run lint"})
	}
	if stacks[detect.Fortran] {
		build = append(build, config.Check{Name: "fpm-build", Run: "fpm build"})
		test = append(test, config.Check{Name: "fpm-test", Run: "fpm test"})
	}
	return
}

// solidityCheckCommands returns Foundry or Hardhat checks.
func solidityCheckCommands(projects []detect.Project) (build, test, lint []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Solidity && p.BuildTool == detect.ToolFoundry {
			return []config.Check{{Name: "forge-build", Run: "forge build"}},
				[]config.Check{{Name: "forge-test", Run: "forge test"}},
				[]config.Check{{Name: "forge-fmt", Run: "forge fmt --check"}}
		}
	}
	return []config.Check{{Name: "hardhat-compile", Run: "npx hardhat compile"}},
		[]config.Check{{Name: "hardhat-test", Run: "npx hardhat test"}},
		nil
}
