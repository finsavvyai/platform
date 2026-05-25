package runner

import "github.com/finsavvyai/pushci/internal/detect"

// terraformChecks returns checks for Terraform/OpenTofu projects.
func terraformChecks() []check {
	return []check{
		{"init", "terraform", []string{"init"}},
		{"validate", "terraform", []string{"validate"}},
		{"plan", "terraform", []string{"plan"}},
		{"fmt", "terraform", []string{"fmt", "-check"}},
	}
}

// helmChecks returns checks for Helm chart projects.
func helmChecks() []check {
	return []check{
		{"deps", "helm", []string{"dependency", "update"}},
		{"lint", "helm", []string{"lint", "."}},
		{"package", "helm", []string{"package", "."}},
	}
}

// solidityChecks returns checks for Solidity projects.
func solidityChecks(p detect.Project) []check {
	if p.BuildTool == detect.ToolFoundry {
		return []check{
			{"build", "forge", []string{"build"}},
			{"test", "forge", []string{"test"}},
			{"fmt", "forge", []string{"fmt", "--check"}},
		}
	}
	return []check{
		{"build", "npx", []string{"hardhat", "compile"}},
		{"test", "npx", []string{"hardhat", "test"}},
	}
}

// bunChecks returns checks for Bun runtime projects.
func bunChecks() []check {
	return []check{
		{"install", "bun", []string{"install"}},
		{"build", "bun", []string{"run", "build"}},
		{"test", "bun", []string{"test"}},
	}
}

// fortranChecks returns checks for Fortran (fpm) projects.
func fortranChecks() []check {
	return []check{
		{"build", "fpm", []string{"build"}},
		{"test", "fpm", []string{"test"}},
	}
}
