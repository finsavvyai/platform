package detect

var deployMarkers = []deployMarker{
	// Cloudflare Workers (API / backend)
	{"wrangler.toml", "cloudflare-workers", "npx wrangler deploy"},
	{"wrangler.json", "cloudflare-workers", "npx wrangler deploy"},

	// Cloudflare Pages (static frontend) — detect by presence of
	// a buildable frontend directory. The most common monorepo
	// layouts put the frontend at web/, frontend/, or apps/web/.
	// pushci init picks the first match and generates a deploy
	// stage with `npm run build && wrangler pages deploy dist`.
	// The user may need to add --project-name=<name> afterward.
	{"web/package.json", "cloudflare-pages", "cd web && npm run build && npx wrangler pages deploy dist"},
	{"frontend/package.json", "cloudflare-pages", "cd frontend && npm run build && npx wrangler pages deploy dist"},
	{"apps/web/package.json", "cloudflare-pages", "cd apps/web && npm run build && npx wrangler pages deploy dist"},

	// Vercel
	{"vercel.json", "vercel", "npx vercel --prod"},
	{".vercel/project.json", "vercel", "npx vercel --prod"},

	// Netlify
	{"netlify.toml", "netlify", "npx netlify deploy --prod"},

	// Fly.io
	{"fly.toml", "fly", "fly deploy"},

	// Railway
	{"railway.toml", "railway", "railway up"},
	{"railway.json", "railway", "railway up"},

	// Render
	{"render.yaml", "render", "echo 'Render deploys via Git push'"},

	// AWS
	{"serverless.yml", "aws-lambda", "npx serverless deploy"},
	{"serverless.yaml", "aws-lambda", "npx serverless deploy"},
	{"template.yaml", "aws-sam", "sam deploy --guided"},
	{"cdk.json", "aws-cdk", "npx cdk deploy"},
	{"apprunner.yaml", "aws-apprunner", "aws apprunner deploy"},
	{"buildspec.yml", "aws-codebuild", "aws codebuild start-build"},
	{"buildspec.yaml", "aws-codebuild", "aws codebuild start-build"},

	// GCP
	{"app.yaml", "gcp-app-engine", "gcloud app deploy"},
	{".gcloudignore", "gcp", "gcloud run deploy"},

	// Azure
	{"azure-pipelines.yml", "azure", "az webapp deploy"},

	// Docker / Kubernetes
	{"docker-compose.yml", "docker-compose", "docker compose up -d --build"},
	{"docker-compose.yaml", "docker-compose", "docker compose up -d --build"},
	{"Dockerfile", "docker", "docker build -t app . && docker push app"},

	// Kubernetes
	{"k8s/", "kubernetes", "kubectl apply -f k8s/"},
	{"kubernetes/", "kubernetes", "kubectl apply -f kubernetes/"},
	{"helm/", "helm", "helm upgrade --install app helm/"},

	// Terraform / Pulumi
	{"main.tf", "terraform", "terraform apply -auto-approve"},
	{"Pulumi.yaml", "pulumi", "pulumi up --yes"},

	// Heroku
	{"Procfile", "heroku", "git push heroku main"},

	// GitHub Pages
	{".github/workflows/pages.yml", "github-pages", "echo 'Deployed via GitHub Pages'"},

	// SSH / generic
	{"deploy.sh", "script", "./deploy.sh"},
	{"Makefile", "make", "make deploy"},
}
