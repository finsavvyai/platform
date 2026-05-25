package deploy

import "context"

func azureApp(ctx context.Context, dir string, env map[string]string) *Result {
	name := env["AZURE_APP_NAME"]
	rg := env["AZURE_RESOURCE_GROUP"]
	if name == "" || rg == "" {
		return &Result{Target: TargetAzureAppService, Output: "AZURE_APP_NAME and AZURE_RESOURCE_GROUP required"}
	}
	r := run(ctx, dir, env, "az", "webapp", "deploy",
		"--name", name, "--resource-group", rg,
		"--type", "zip", "--src-path", "deploy.zip")
	r.Target = TargetAzureAppService
	return r
}

func docker(ctx context.Context, dir string, env map[string]string) *Result {
	compose := env["COMPOSE_FILE"]
	if compose == "" {
		compose = "docker-compose.yml"
	}
	run(ctx, dir, env, "docker-compose", "-f", compose, "down")
	r := run(ctx, dir, env, "docker-compose", "-f", compose, "up", "-d")
	r.Target = TargetDocker
	return r
}

func k8s(ctx context.Context, dir string, env map[string]string) *Result {
	manifest := env["K8S_MANIFEST"]
	if manifest == "" {
		manifest = "k8s/"
	}
	r := run(ctx, dir, env, "kubectl", "apply", "-f", manifest)
	r.Target = TargetK8s
	return r
}

func vercel(ctx context.Context, dir string, env map[string]string) *Result {
	r := run(ctx, dir, env, "npx", "vercel", "--prod", "--yes")
	r.Target = TargetVercel
	return r
}

func railway(ctx context.Context, dir string, env map[string]string) *Result {
	r := run(ctx, dir, env, "railway", "up")
	r.Target = TargetRailway
	return r
}

func fly(ctx context.Context, dir string, env map[string]string) *Result {
	r := run(ctx, dir, env, "flyctl", "deploy", "--now")
	r.Target = TargetFly
	return r
}

func netlify(ctx context.Context, dir string, env map[string]string) *Result {
	distDir := env["NETLIFY_DIST_DIR"]
	if distDir == "" {
		distDir = "dist"
	}
	r := run(ctx, dir, env, "npx", "netlify", "deploy",
		"--prod", "--dir", distDir)
	r.Target = TargetNetlify
	return r
}

func sshDeploy(ctx context.Context, dir string, env map[string]string) *Result {
	host := env["SSH_HOST"]
	path := env["SSH_PATH"]
	if host == "" || path == "" {
		return &Result{Target: TargetSSH, Output: "SSH_HOST and SSH_PATH required"}
	}
	r := run(ctx, dir, env, "rsync", "-avz", "--delete",
		"./", host+":"+path)
	r.Target = TargetSSH
	return r
}
