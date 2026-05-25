package migrate

import (
	"fmt"
	"strings"
)

func buildActionsYAML(jobs []parsedJob, globalEnv map[string]string, result *ConvertResult) string {
	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")

	for _, job := range jobs {
		fmt.Fprintf(&b, "  - name: %s\n    checks:\n", job.name)
		for i, step := range job.steps {
			checkName := fmt.Sprintf("%s-%d", job.name, i+1)
			fmt.Fprintf(&b, "      - name: %s\n        run: %s\n", checkName, step)
		}
		if len(job.needs) > 0 {
			b.WriteString("    depends_on:\n")
			for _, n := range job.needs {
				fmt.Fprintf(&b, "      - %s\n", n)
			}
		}
		mergedEnv := mergeEnvs(globalEnv, job.env)
		if len(mergedEnv) > 0 {
			b.WriteString("    env:\n")
			for k, v := range mergedEnv {
				fmt.Fprintf(&b, "      %s: \"%s\"\n", k, v)
			}
		}
		if len(job.onlyOn) > 0 {
			b.WriteString("    only_on:\n")
			for _, br := range job.onlyOn {
				fmt.Fprintf(&b, "      - %s\n", br)
			}
		}
		result.StagesConverted++
	}
	return b.String()
}

func mergeEnvs(global, local map[string]string) map[string]string {
	merged := map[string]string{}
	for k, v := range global {
		merged[k] = v
	}
	for k, v := range local {
		merged[k] = v
	}
	return merged
}

func mapAction(uses string) string {
	skip := []string{
		"actions/checkout", "actions/setup-node", "actions/setup-python",
		"actions/setup-go", "actions/setup-java", "actions/cache",
		"actions/upload-artifact", "actions/download-artifact",
	}
	for _, s := range skip {
		if strings.HasPrefix(uses, s) {
			return ""
		}
	}
	mappings := map[string]string{ // #nosec G101 -- doc strings reference env var names, not hardcoded secrets
		"docker/build-push-action":              "docker build -t $IMAGE . && docker push $IMAGE",
		"docker/login-action":                   "echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin",
		"aws-actions/configure-aws-credentials": "# AWS credentials: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY",
		"google-github-actions/auth":            "# GCP auth: set GOOGLE_APPLICATION_CREDENTIALS",
		"azure/login":                           "# Azure auth: set AZURE_CREDENTIALS",
		"cloudflare/wrangler-action":            "npx wrangler deploy",
		"amondnet/vercel-action":                "npx vercel --prod",
		"netlify/actions":                       "npx netlify deploy --prod",
	}
	for prefix, cmd := range mappings {
		if strings.HasPrefix(uses, prefix) {
			return cmd
		}
	}
	return ""
}
