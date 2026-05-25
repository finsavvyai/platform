// Package detect — Terraform HCL enrichment.
//
// The baseline `markers` table already classifies `*.tf`,
// `terraform.tfvars`, and `.terraform.lock.hcl` as {Terraform, ""}.
// This file adds a richer scanner so callers can enumerate providers,
// modules, backend config and the presence of companion lint/sec
// configs for smarter pipeline generation. Stdlib only; regex/string
// walking is good enough for structural discovery. Terragrunt
// (`terragrunt.hcl`) is detected and flagged.

package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// ScanTerraformDir walks `root` non-recursively and aggregates .tf
// file structure into one project. Honours `.tflint.hcl`, `.tfsec*`,
// `.checkov*`, and `terragrunt.hcl` companions.
func ScanTerraformDir(root string) (*TerraformProject, error) {
	proj := &TerraformProject{}
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	tfFiles := collectTfAndCompanions(root, entries, proj)
	if st, err := os.Stat(filepath.Join(root, ".tfsec")); err == nil && st.IsDir() {
		proj.HasTfsec = true
	}
	for _, path := range tfFiles {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		mergeScan(proj, preprocessHcl(string(data)))
	}
	return proj, nil
}

func collectTfAndCompanions(root string, entries []os.DirEntry, proj *TerraformProject) []string {
	tfFiles := []string{}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasSuffix(name, ".tf") {
			tfFiles = append(tfFiles, filepath.Join(root, name))
		}
		flagCompanion(name, proj)
	}
	return tfFiles
}

func flagCompanion(name string, proj *TerraformProject) {
	switch name {
	case ".tflint.hcl", "tflint.hcl":
		proj.HasTfLint = true
	case ".tfsec.yml", ".tfsec.yaml":
		proj.HasTfsec = true
	case ".checkov.yml", ".checkov.yaml":
		proj.HasCheckov = true
	case "terragrunt.hcl":
		proj.HasTerragrunt = true
	}
}

func mergeScan(proj *TerraformProject, src string) {
	for _, p := range scanProviders(src) {
		if !containsProvider(proj.Providers, p.Name) {
			proj.Providers = append(proj.Providers, p)
		}
	}
	proj.Modules = append(proj.Modules, scanModules(src)...)
	if proj.Backend == nil {
		proj.Backend = scanBackend(src)
	}
	if proj.RequiredVersion == "" {
		proj.RequiredVersion = scanRequiredVersion(src)
	}
}

func containsProvider(list []TfProvider, name string) bool {
	for _, p := range list {
		if p.Name == name {
			return true
		}
	}
	return false
}
