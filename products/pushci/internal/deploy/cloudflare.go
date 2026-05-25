package deploy

import "context"

func cfPages(ctx context.Context, dir string, env map[string]string) *Result {
	project := env["CF_PROJECT"]
	if project == "" {
		project = "app"
	}
	distDir := env["CF_DIST_DIR"]
	if distDir == "" {
		distDir = "dist"
	}
	r := run(ctx, dir, env, "npx", "wrangler", "pages", "deploy",
		distDir, "--project-name", project)
	r.Target = TargetCloudflarePages
	return r
}

func cfWorkers(ctx context.Context, dir string, env map[string]string) *Result {
	r := run(ctx, dir, env, "npx", "wrangler", "deploy")
	r.Target = TargetCloudflareWorkers
	return r
}
