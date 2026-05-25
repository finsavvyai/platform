package deploy

import "context"

const (
	TargetBicep Target = "bicep"
)

// bicep deploys an Azure Bicep template via `az deployment group create`.
// Requires Azure CLI logged in (`az login` or service-principal env vars).
func bicep(ctx context.Context, dir string, env map[string]string) *Result {
	rg := env["AZURE_RESOURCE_GROUP"]
	if rg == "" {
		return &Result{
			Target: TargetBicep,
			Output: "AZURE_RESOURCE_GROUP required",
		}
	}
	tmpl := env["AZURE_BICEP_TEMPLATE"]
	if tmpl == "" {
		tmpl = "main.bicep"
	}

	args := []string{
		"deployment", "group", "create",
		"--resource-group", rg,
		"--template-file", tmpl,
	}
	if params := env["AZURE_BICEP_PARAMS"]; params != "" {
		args = append(args, "--parameters", params)
	}
	if name := env["AZURE_DEPLOYMENT_NAME"]; name != "" {
		args = append(args, "--name", name)
	}

	r := run(ctx, dir, env, "az", args...)
	r.Target = TargetBicep
	return r
}
