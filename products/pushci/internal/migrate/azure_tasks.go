package migrate

import "strings"

func mapAzureTask(task string) string {
	mappings := map[string]string{
		"NodeTool@0":               "",
		"UseNode@1":                "",
		"UsePythonVersion@0":       "",
		"UseDotNet@2":              "",
		"Docker@2":                 "docker build -t $IMAGE . && docker push $IMAGE",
		"Npm@1":                    "npm ci && npm test",
		"DotNetCoreCLI@2":          "dotnet build && dotnet test",
		"PublishBuildArtifacts@1":  "# artifacts: use pushci artifacts push",
		"DownloadBuildArtifacts@0": "# artifacts: use pushci artifacts pull",
		"AzureWebApp@1":            "az webapp deploy",
		"AzureFunctionApp@2":       "func azure functionapp publish",
		"KubernetesManifest@0":     "kubectl apply -f manifests/",
		"HelmDeploy@0":             "helm upgrade --install app chart/",
	}
	for prefix, cmd := range mappings {
		if strings.HasPrefix(task, prefix) {
			return cmd
		}
	}
	return ""
}
