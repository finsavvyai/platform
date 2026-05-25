package skill

var deploySkills = []Skill{
	{
		ID: "cloudflare-deploy", Name: "Cloudflare Pages", Version: "1.0.0",
		Category: CategoryDeploy, Author: "pushci", Verified: true, Installs: 10800,
		Description: "Deploy static sites and SSR apps to Cloudflare Pages.",
		Tags:        []string{"Cloudflare", "Pages", "Workers", "Edge"},
		Steps: []Step{
			{Name: "Build", Run: "npm run build"},
			{Name: "Deploy", Run: "npx wrangler pages deploy dist --project-name $PROJECT_NAME"},
		},
		Config: map[string]string{"PROJECT_NAME": ""},
	},
	{
		ID: "k8s-deploy", Name: "Kubernetes Deploy", Version: "1.0.0",
		Category: CategoryDeploy, Author: "pushci", Verified: true, Installs: 8400,
		Description: "Rolling deployment to Kubernetes with health checks and rollback.",
		Tags:        []string{"Kubernetes", "K8s", "Helm", "Rolling Deploy"},
		Steps: []Step{
			{Name: "Apply", Run: "kubectl apply -f k8s/"},
			{Name: "Rollout Wait", Run: "kubectl rollout status deployment/$DEPLOY_NAME --timeout=300s"},
		},
		Config: map[string]string{"DEPLOY_NAME": ""},
	},
	{
		ID: "aws-lambda", Name: "AWS Lambda Deploy", Version: "1.0.0",
		Category: CategoryDeploy, Author: "pushci", Verified: true, Installs: 6200,
		Description: "Package and deploy serverless functions to AWS Lambda.",
		Tags:        []string{"AWS", "Lambda", "Serverless", "API Gateway"},
		Steps: []Step{
			{Name: "Package", Run: "zip -r function.zip ."},
			{Name: "Deploy", Run: "aws lambda update-function-code --function-name $FUNCTION_NAME --zip-file fileb://function.zip"},
		},
		Config: map[string]string{"FUNCTION_NAME": ""},
	},
}

var checkSkills = []Skill{
	{
		ID: "lint-strict", Name: "Strict Linting", Version: "1.0.0",
		Category: CategoryCheck, Author: "pushci", Verified: true, Installs: 13100,
		Description: "Enforce linter with zero-tolerance for warnings.",
		Tags:        []string{"Lint", "ESLint", "Pylint", "Code Quality"},
		Steps:       []Step{{Name: "Lint", Run: "pushci lint --strict", OnFail: "block"}},
	},
	{
		ID: "coverage-gate", Name: "Coverage Gate", Version: "1.0.0",
		Category: CategoryCheck, Author: "pushci", Verified: true, Installs: 9800,
		Description: "Fail builds if test coverage drops below threshold.",
		Tags:        []string{"Coverage", "Testing", "Quality Gate"},
		Steps:       []Step{{Name: "Check Coverage", Run: "pushci coverage --min 80", OnFail: "block"}},
		Config:      map[string]string{"MIN_COVERAGE": "80"},
	},
	{
		ID: "bundle-size", Name: "Bundle Size Check", Version: "1.0.0",
		Category: CategoryCheck, Author: "community", Verified: false, Installs: 5400,
		Description: "Track JavaScript bundle size per commit.",
		Tags:        []string{"Bundle", "Performance", "Webpack", "Vite"},
		Steps:       []Step{{Name: "Check Bundle", Run: "npx size-limit", OnFail: "block"}},
	},
	{
		ID: "lighthouse", Name: "Lighthouse CI", Version: "1.0.0",
		Category: CategoryCheck, Author: "community", Verified: false, Installs: 4700,
		Description: "Run Google Lighthouse audits on every build.",
		Tags:        []string{"Lighthouse", "Performance", "A11y", "SEO"},
		Steps:       []Step{{Name: "Lighthouse", Run: "npx @lhci/cli autorun"}},
	},
}

var aiSkills = []Skill{
	{
		ID: "ai-review", Name: "AI Code Review", Version: "1.0.0",
		Category: CategoryAI, Author: "pushci", Verified: true, Installs: 15900,
		Description: "AI-powered code review that catches bugs and suggests improvements.",
		Tags:        []string{"AI", "Code Review", "Claude", "Quality"},
		Steps:       []Step{{Name: "AI Review", Run: "pushci ask 'review the changes in this commit for bugs and improvements'"}},
	},
	{
		ID: "ai-changelog", Name: "AI Changelog", Version: "1.0.0",
		Category: CategoryAI, Author: "pushci", Verified: true, Installs: 7600,
		Description: "Auto-generate changelogs from commits using AI.",
		Tags:        []string{"AI", "Changelog", "Semver", "Release"},
		Steps:       []Step{{Name: "Generate Changelog", Run: "pushci ask 'generate a changelog entry for the latest commits'"}},
	},
	{
		ID: "ai-test-gen", Name: "AI Test Generator", Version: "1.0.0",
		Category: CategoryAI, Author: "pushci", Verified: true, Installs: 11300,
		Description: "Generate missing unit tests using AI targeting uncovered functions.",
		Tags:        []string{"AI", "Testing", "Unit Tests", "Coverage"},
		Steps:       []Step{{Name: "Generate Tests", Run: "pushci ask 'generate unit tests for uncovered functions'"}},
	},
	{
		ID: "ai-fix", Name: "AI Auto-Fix", Version: "1.0.0",
		Category: CategoryAI, Author: "pushci", Verified: true, Installs: 9100,
		Description: "Automatically fix failing tests and lint errors using AI.",
		Tags:        []string{"AI", "Auto-fix", "Self-healing", "Pipeline"},
		Steps:       []Step{{Name: "Auto Fix", Run: "pushci heal"}},
	},
}
