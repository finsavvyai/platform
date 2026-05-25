package detect

import (
	"os"
	"path/filepath"
	"testing"
)

const singleProviderTf = `
terraform {
  required_version = "~> 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}
`

const multiProviderTf = `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.5.1"
    }
    null = {
      source = "hashicorp/null"
    }
  }
}
`

const moduleTf = `
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.0"
}

module "local_stuff" {
  source = "./modules/stuff"
}
`

const s3BackendTf = `
terraform {
  backend "s3" {
    bucket = "norlys-tfstate"
    key    = "prod/billing/terraform.tfstate"
    region = "eu-north-1"
  }
}
`

func TestScanTerraformSingleProvider(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte(singleProviderTf), 0o644); err != nil {
		t.Fatal(err)
	}
	proj, err := ScanTerraformDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(proj.Providers) != 1 || proj.Providers[0].Name != "aws" {
		t.Fatalf("expected single aws provider, got %+v", proj.Providers)
	}
	if proj.Providers[0].Source != "hashicorp/aws" {
		t.Errorf("expected source hashicorp/aws, got %q", proj.Providers[0].Source)
	}
	if proj.RequiredVersion != "~> 1.5" {
		t.Errorf("expected required_version ~> 1.5, got %q", proj.RequiredVersion)
	}
}

func TestScanTerraformMultipleProviders(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte(multiProviderTf), 0o644); err != nil {
		t.Fatal(err)
	}
	proj, err := ScanTerraformDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(proj.Providers) != 3 {
		t.Fatalf("expected 3 providers, got %d: %+v", len(proj.Providers), proj.Providers)
	}
}

func TestScanTerraformModuleBlock(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte(moduleTf), 0o644); err != nil {
		t.Fatal(err)
	}
	proj, err := ScanTerraformDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(proj.Modules) != 2 {
		t.Fatalf("expected 2 modules, got %+v", proj.Modules)
	}
	var vpc *TfModule
	for i := range proj.Modules {
		if proj.Modules[i].Name == "vpc" {
			vpc = &proj.Modules[i]
		}
	}
	if vpc == nil || vpc.Version != "5.5.0" {
		t.Fatalf("expected vpc module v5.5.0, got %+v", vpc)
	}
}

func TestScanTerraformS3Backend(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "backend.tf"), []byte(s3BackendTf), 0o644); err != nil {
		t.Fatal(err)
	}
	proj, err := ScanTerraformDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if proj.Backend == nil || proj.Backend.Type != "s3" {
		t.Fatalf("expected s3 backend, got %+v", proj.Backend)
	}
	if proj.Backend.Config["bucket"] != "norlys-tfstate" {
		t.Errorf("expected bucket norlys-tfstate, got %q", proj.Backend.Config["bucket"])
	}
}

func TestScanTerraformTflintConfigDetected(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte(singleProviderTf), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".tflint.hcl"), []byte("plugin \"aws\" { enabled = true }"), 0o644); err != nil {
		t.Fatal(err)
	}
	proj, err := ScanTerraformDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !proj.HasTfLint {
		t.Errorf("expected HasTfLint=true")
	}
}

func TestScanTerraformDirMultipleFiles(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "providers.tf"), []byte(multiProviderTf), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "backend.tf"), []byte(s3BackendTf), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte(moduleTf), 0o644); err != nil {
		t.Fatal(err)
	}
	proj, err := ScanTerraformDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(proj.Providers) != 3 {
		t.Errorf("expected 3 providers across files, got %d", len(proj.Providers))
	}
	if len(proj.Modules) != 2 {
		t.Errorf("expected 2 modules across files, got %d", len(proj.Modules))
	}
	if proj.Backend == nil {
		t.Errorf("expected backend")
	}
}

func TestScanTerragrunt(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "terragrunt.hcl"), []byte("terraform { source = \"../modules/vpc\" }"), 0o644); err != nil {
		t.Fatal(err)
	}
	proj, err := ScanTerraformDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !proj.HasTerragrunt {
		t.Errorf("expected HasTerragrunt=true")
	}
}

func TestScanTerraformIgnoresCommentedProviders(t *testing.T) {
	dir := t.TempDir()
	src := `
# terraform {
#   required_providers {
#     evil = { source = "bad/evil" }
#   }
# }

terraform {
  required_providers {
    good = { source = "hashicorp/good" }
  }
}
`
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte(src), 0o644); err != nil {
		t.Fatal(err)
	}
	proj, err := ScanTerraformDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(proj.Providers) != 1 || proj.Providers[0].Name != "good" {
		t.Fatalf("expected only 'good' provider, got %+v", proj.Providers)
	}
}
