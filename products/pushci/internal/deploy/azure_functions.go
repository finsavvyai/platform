package deploy

import "context"

const (
	TargetAzureFunctions Target = "azure-functions"
)

// azureFunctions deploys via Azure Functions Core Tools (`func`).
// Requires `func` on PATH and Azure CLI logged in.
func azureFunctions(ctx context.Context, dir string, env map[string]string) *Result {
	app := env["AZURE_FUNCTION_APP"]
	if app == "" {
		return &Result{
			Target: TargetAzureFunctions,
			Output: "AZURE_FUNCTION_APP required (Function App name)",
		}
	}
	args := []string{"azure", "functionapp", "publish", app}
	if rg := env["AZURE_RESOURCE_GROUP"]; rg != "" {
		args = append(args, "--resource-group", rg)
	}
	switch env["AZURE_FUNCTION_BUILD"] {
	case "remote":
		args = append(args, "--build", "remote")
	case "local":
		args = append(args, "--build", "local")
	}

	r := run(ctx, dir, env, "func", args...)
	r.Target = TargetAzureFunctions
	return r
}
