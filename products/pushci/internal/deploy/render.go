package deploy

import "context"

// render triggers a Render.com deploy via the service's Deploy Hook.
// User creates the hook in Render dashboard → Settings → Deploy Hook,
// stores the full URL (including the `key` query param) in env.
func render(ctx context.Context, dir string, env map[string]string) *Result {
	hook := env["RENDER_DEPLOY_HOOK_URL"]
	if hook == "" {
		return &Result{
			Target: TargetRender,
			Output: "RENDER_DEPLOY_HOOK_URL required (Render dashboard → service → Settings → Deploy Hook)",
		}
	}
	r := run(ctx, dir, env, "curl", "-fsS", "-X", "POST", hook)
	r.Target = TargetRender
	return r
}
