package detect

// TfProvider is one entry from `terraform.required_providers`.
type TfProvider struct {
	Name    string
	Source  string
	Version string
}

// TfModule is one top-level `module "x" {}` block.
type TfModule struct {
	Name    string
	Source  string
	Version string
}

// TfBackend captures the `terraform.backend "x" {}` configuration.
type TfBackend struct {
	Type   string
	Config map[string]string
}

// TerraformProject is the enriched view of a Terraform directory.
type TerraformProject struct {
	Providers       []TfProvider
	Modules         []TfModule
	Backend         *TfBackend
	RequiredVersion string
	HasTfLint       bool
	HasTfsec        bool
	HasCheckov      bool
	HasTerragrunt   bool
}
