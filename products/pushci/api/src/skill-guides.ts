// Setup guides and prerequisites for each skill.

interface SkillGuide {
  guide: string;
  prerequisites: string[];
}

export const SKILL_GUIDES: Record<string, SkillGuide> = {
  // --- Templates ---
  "nextjs-vercel": {
    guide: "Runs your Next.js CI pipeline: install deps, lint, test, build, then deploy to Vercel.\n\nHow it works:\n1. npm ci — clean install from lockfile\n2. next lint — checks ESLint rules\n3. npm test — runs your test suite (blocks on failure)\n4. next build — production build (blocks on failure)\n5. vercel --prod — deploys to your Vercel project",
    prerequisites: ["Node.js 18+", "Vercel CLI (npx vercel)", "Vercel project linked (vercel link)", "VERCEL_TOKEN env var for CI deploys"],
  },
  "django-aws": {
    guide: "Python Django pipeline with pytest and AWS ECS deployment.\n\nHow it works:\n1. Install Python dependencies from requirements.txt\n2. Check migrations are up to date (no unapplied)\n3. Run pytest with short tracebacks (blocks on failure)\n4. Force new deployment on AWS ECS",
    prerequisites: ["Python 3.8+", "pip", "AWS CLI configured", "ECS cluster and service already created"],
  },
  "go-docker": {
    guide: "Go pipeline with race detection and Docker image push.\n\nHow it works:\n1. go vet — static analysis for suspicious constructs\n2. go test -race — runs tests with race detector (blocks on failure)\n3. Docker build — creates container image with commit SHA tag\n4. Docker push — pushes to your container registry",
    prerequisites: ["Go 1.21+", "Docker installed and running", "Container registry access (Docker Hub, ECR, GCR)"],
  },
  "rails-fly": {
    guide: "Ruby on Rails pipeline with RSpec and Fly.io deployment.\n\nHow it works:\n1. bundle install — install Ruby gems\n2. Prepare test database\n3. Run RSpec test suite (blocks on failure)\n4. Deploy to Fly.io",
    prerequisites: ["Ruby 3.0+", "Bundler", "PostgreSQL (for tests)", "Fly CLI (flyctl)"],
  },
  "rust-shuttle": {
    guide: "Rust pipeline with clippy linting and Shuttle.rs deployment.\n\nHow it works:\n1. cargo clippy — lint with warnings as errors\n2. cargo test — run all tests (blocks on failure)\n3. cargo shuttle deploy — deploy to Shuttle.rs",
    prerequisites: ["Rust toolchain (rustup)", "Shuttle CLI (cargo install cargo-shuttle)", "Shuttle.rs account"],
  },
  "flutter-firebase": {
    guide: "Flutter mobile pipeline with widget tests and Firebase App Distribution.\n\nHow it works:\n1. Get dependencies\n2. Run static analysis\n3. Run widget tests (blocks on failure)\n4. Build release APK\n5. Distribute via Firebase",
    prerequisites: ["Flutter SDK", "Android SDK", "Firebase CLI", "Firebase project configured"],
  },

  // --- Security ---
  "secret-scan": {
    guide: "Scans your codebase for leaked API keys, tokens, passwords, and private keys.\n\nHow it works:\nRuns pushci's built-in secret scanner against all files. Uses pattern matching for 40+ secret types including AWS keys, GitHub tokens, Stripe keys, and JWTs.\n\nBlocks the pipeline if any secrets are found — preventing accidental commits of credentials.",
    prerequisites: ["PushCI CLI installed"],
  },
  "trivy-scan": {
    guide: "Scans container images and filesystem for CVEs and misconfigurations using Trivy.\n\nHow it works:\n1. Scan your Docker image for HIGH/CRITICAL vulnerabilities (blocks if found)\n2. Scan filesystem for additional issues\n\nTrivy checks against NVD, GitHub Advisories, and distro-specific databases.",
    prerequisites: ["Trivy installed (brew install trivy)", "Docker image name set in IMAGE config var"],
  },
  "snyk-scan": {
    guide: "Comprehensive security scanning with Snyk — dependencies, code, and monitoring.\n\nHow it works:\n1. Test dependencies for known vulnerabilities (blocks on HIGH+)\n2. Static code analysis for security bugs\n3. Monitor mode — tracks new vulnerabilities over time",
    prerequisites: ["Snyk CLI (npm i -g snyk)", "Snyk account + authenticated (snyk auth)"],
  },
  "semgrep": {
    guide: "Static analysis with 2000+ rules covering OWASP Top 10, injection, XSS, and hardcoded secrets.\n\nHow it works:\nRuns Semgrep with auto-detected rulesets for your language. Blocks on ERROR severity findings.\n\nCovers: SQL injection, XSS, SSRF, path traversal, insecure deserialization, and more.",
    prerequisites: ["Semgrep CLI (pip install semgrep or brew install semgrep)"],
  },
  "gitleaks": {
    guide: "Scans your entire git history for leaked secrets — not just current files.\n\nHow it works:\nGitleaks examines every commit in your repo for API keys, passwords, and tokens. Catches secrets that were committed and later deleted.\n\nBlocks pipeline if any secrets found in history.",
    prerequisites: ["Gitleaks installed (brew install gitleaks)"],
  },
  "license-check": {
    guide: "Verifies all dependencies use approved open-source licenses.\n\nHow it works:\nScans node_modules/pip packages and checks each license against an allowlist (MIT, Apache-2.0, BSD, ISC). Blocks if a dependency uses a copyleft or unknown license.\n\nProtects against accidental GPL contamination.",
    prerequisites: ["Node.js (for license-checker)", "npm install -g license-checker"],
  },
  "sbom-gen": {
    guide: "Generates a Software Bill of Materials in CycloneDX format.\n\nHow it works:\nScans your dependencies and outputs a machine-readable SBOM listing every component, version, and license. Required for supply chain compliance.\n\nOutput: sbom.json in CycloneDX format.",
    prerequisites: ["cyclonedx-bom CLI (npm i -g @cyclonedx/bom)"],
  },
  "vulnerability-scan": {
    guide: "Scans dependencies for known CVEs. Blocks on critical vulnerabilities.\n\nHow it works:\nRuns pushci's vulnerability scanner against your dependency tree. Checks npm audit, pip safety, go vuln, and cargo audit depending on your stack.\n\nBlocks pipeline on CRITICAL or HIGH severity CVEs.",
    prerequisites: ["PushCI CLI installed"],
  },
  "checkov": {
    guide: "Infrastructure-as-Code scanner for Terraform, CloudFormation, K8s, and Dockerfiles.\n\nHow it works:\nCheckov analyzes your IaC files for security misconfigurations: open security groups, unencrypted storage, missing logging, overly permissive IAM policies.",
    prerequisites: ["Checkov (pip install checkov)", "IaC files in your repo"],
  },
  "zap-scan": {
    guide: "Dynamic Application Security Testing — scans your running app for vulnerabilities.\n\nHow it works:\nLaunches OWASP ZAP against your target URL and runs a baseline scan checking for XSS, SQL injection, CSRF, and other runtime vulnerabilities.\n\nRequires a running instance of your app.",
    prerequisites: ["Docker installed", "App running at TARGET_URL", "Network access from runner to app"],
  },
  "grype": {
    guide: "Fast vulnerability scanner for container images and filesystems.\n\nHow it works:\nAnchore-powered Grype scans your project directory for vulnerable packages. Fails on HIGH severity findings.\n\nFaster than Trivy for filesystem scans, good as a secondary scanner.",
    prerequisites: ["Grype installed (brew install grype or curl -sSf https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh)"],
  },

  // --- Notifications ---
  "slack-notify": {
    guide: "Posts build results to Slack with rich formatting.\n\nHow it works:\nAfter your pipeline runs, sends a Slack message with: status (pass/fail), repo, branch, commit, duration, and link to dashboard.\n\nUses incoming webhook — no bot permissions needed.",
    prerequisites: ["Slack workspace", "Incoming Webhook URL (Slack App > Incoming Webhooks > Add New)"],
  },
  "discord-notify": {
    guide: "Sends build status embeds to Discord channels.\n\nHow it works:\nPosts a rich embed with pipeline status, commit info, and duration to your Discord channel via webhook.",
    prerequisites: ["Discord server", "Webhook URL (Channel Settings > Integrations > Webhooks > New)"],
  },
  "email-digest": {
    guide: "Daily email summary of pipeline runs and failures.\n\nHow it works:\nSends a styled HTML email digest with: total runs, pass rate, failures with links, and cost savings. Delivered via Resend.",
    prerequisites: ["Email address for delivery"],
  },
  "teams-notify": {
    guide: "Sends build status cards to Microsoft Teams channels.\n\nHow it works:\nPosts an adaptive card with pipeline status to Teams via incoming webhook connector.",
    prerequisites: ["Teams channel", "Incoming Webhook connector URL"],
  },
  "pagerduty-alert": {
    guide: "Triggers PagerDuty incidents on failures, auto-resolves on success.\n\nHow it works:\nOn failure: creates a PagerDuty incident with details. On success: resolves the incident. Keeps your on-call team notified without noise.",
    prerequisites: ["PagerDuty account", "Events API v2 routing key"],
  },
  "datadog-events": {
    guide: "Sends CI/CD events to Datadog for monitoring and analytics.\n\nHow it works:\nPosts events to Datadog: deployments, build metrics, failure rates. Integrates with Datadog dashboards and alerts.",
    prerequisites: ["Datadog account", "API key"],
  },

  // --- Checks ---
  "lint-strict": {
    guide: "Enforces linter with zero tolerance for warnings.\n\nHow it works:\nRuns pushci's lint command in strict mode — treats all warnings as errors. Supports ESLint, Pylint, golangci-lint, clippy depending on your stack.\n\nBlocks pipeline on any lint issue.",
    prerequisites: ["PushCI CLI installed", "Linter config in your project (.eslintrc, .pylintrc, etc.)"],
  },
  "coverage-gate": {
    guide: "Fails builds if test coverage drops below your threshold.\n\nHow it works:\nRuns your test suite with coverage collection, then checks if line coverage meets the minimum (default: 80%). Blocks if below threshold.\n\nConfigurable via MIN_COVERAGE.",
    prerequisites: ["Test suite configured", "Coverage tool (istanbul/nyc, coverage.py, go cover)"],
  },
  "bundle-size": {
    guide: "Tracks JavaScript bundle size and fails if beyond threshold.\n\nHow it works:\nRuns size-limit to check your production bundle. Prevents bloat from sneaking in — catches large dependencies, missing tree-shaking, and accidental imports.",
    prerequisites: ["size-limit configured (.size-limit.js)", "npm install -D size-limit"],
  },
  "lighthouse": {
    guide: "Runs Google Lighthouse audits on every build.\n\nHow it works:\nLaunches Lighthouse CI against your app's URLs. Checks performance, accessibility, best practices, and SEO scores. Can block on score thresholds.",
    prerequisites: ["@lhci/cli installed", "App running or buildable", "lighthouserc.js config"],
  },
  "playwright-e2e": {
    guide: "Cross-browser E2E testing with Playwright.\n\nHow it works:\n1. Install browser binaries (Chromium, Firefox, WebKit)\n2. Run all E2E tests across browsers (blocks on failure)\n3. Generate HTML report with screenshots",
    prerequisites: ["Playwright installed (npm i -D @playwright/test)", "playwright.config.ts", "Test files in tests/ or e2e/"],
  },
  "cypress-e2e": {
    guide: "Component and E2E testing with Cypress.\n\nHow it works:\nRuns all Cypress specs in headless mode. Supports component testing and full E2E flows with time-travel debugging.\n\nBlocks on any test failure.",
    prerequisites: ["Cypress installed (npm i -D cypress)", "cypress.config.ts", "Specs in cypress/e2e/"],
  },
  "vitest": {
    guide: "Blazing fast unit tests with Vitest.\n\nHow it works:\n1. Run all test files with Vitest (blocks on failure)\n2. Generate coverage report\n\nNative ESM, TypeScript, JSX support. Jest-compatible API.",
    prerequisites: ["Vitest installed (npm i -D vitest)", "Test files (*.test.ts, *.spec.ts)"],
  },
  "jest": {
    guide: "Standard JavaScript test framework with snapshot testing.\n\nHow it works:\nRuns Jest in CI mode with coverage collection. Supports snapshots, mocking, and parallel test execution.\n\nBlocks on any test failure.",
    prerequisites: ["Jest installed (npm i -D jest)", "jest.config.js or package.json jest config"],
  },
  "pytest": {
    guide: "Python testing with fixtures, parametrize, and coverage.\n\nHow it works:\nRuns pytest with short tracebacks and coverage reporting. Shows which lines are not covered.\n\nBlocks on any test failure.",
    prerequisites: ["Python 3.8+", "pytest installed (pip install pytest pytest-cov)"],
  },
  "go-test": {
    guide: "Go test suite with race detection and coverage.\n\nHow it works:\n1. go vet — catch suspicious constructs\n2. go test -race -cover — run tests with race detector + coverage\n\nRace detector catches data races before production.",
    prerequisites: ["Go 1.21+"],
  },
  "eslint-strict": {
    guide: "Zero-tolerance ESLint — no warnings, no errors allowed.\n\nHow it works:\nRuns ESLint across your entire project with --max-warnings 0. Any warning or error blocks the pipeline.\n\nSupports TypeScript, React, Vue via your eslintrc config.",
    prerequisites: ["ESLint installed", ".eslintrc.js or eslint.config.js"],
  },
  "prettier-check": {
    guide: "Verifies code formatting matches Prettier config.\n\nHow it works:\nRuns prettier --check against all files. Fails if any file doesn't match the expected formatting. Doesn't auto-fix — just reports.\n\nRun prettier --write locally to fix before pushing.",
    prerequisites: ["Prettier installed", ".prettierrc config"],
  },
  "biome": {
    guide: "Ultra-fast linter + formatter. Replaces ESLint + Prettier.\n\nHow it works:\nBiome checks linting rules and formatting in a single pass. Rust-powered — 10-100x faster than ESLint.\n\nBlocks on any issue found.",
    prerequisites: ["@biomejs/biome installed (npm i -D @biomejs/biome)"],
  },
  "sonarqube": {
    guide: "Deep code quality analysis — bugs, vulnerabilities, code smells, tech debt.\n\nHow it works:\nRuns SonarQube scanner against your codebase. Reports: security vulnerabilities, reliability issues, maintainability problems, and code duplications.\n\nRequires a SonarQube server (cloud or self-hosted).",
    prerequisites: ["SonarQube server", "sonar-scanner CLI", "PROJECT_KEY, SONAR_TOKEN, SONAR_HOST_URL config vars"],
  },
  "depcheck": {
    guide: "Finds unused dependencies in your project.\n\nHow it works:\nScans your imports/requires and compares against package.json. Reports dependencies that are installed but never used.\n\nBlocks pipeline so you clean up before merging.",
    prerequisites: ["Node.js project with package.json"],
  },

  // --- Deploy ---
  "cloudflare-deploy": {
    guide: "Deploy static sites and SSR apps to Cloudflare Pages.\n\nHow it works:\n1. Build your project (npm run build)\n2. Deploy the dist folder to Cloudflare Pages\n\nSupports Next.js, Astro, SvelteKit, Remix, and static sites.",
    prerequisites: ["Cloudflare account", "Wrangler CLI", "PROJECT_NAME configured in Cloudflare Pages"],
  },
  "k8s-deploy": {
    guide: "Rolling deployment to Kubernetes with health checks.\n\nHow it works:\n1. Apply Kubernetes manifests from k8s/ directory\n2. Wait for rollout to complete (5 min timeout)\n\nUses kubectl — make sure your kubeconfig is set.",
    prerequisites: ["kubectl configured", "Kubernetes cluster access", "Manifests in k8s/ directory"],
  },
  "aws-lambda": {
    guide: "Package and deploy serverless functions to AWS Lambda.\n\nHow it works:\n1. Zip your function code\n2. Upload to AWS Lambda using the AWS CLI\n\nFor Node.js/Python functions. Uses your local AWS credentials.",
    prerequisites: ["AWS CLI configured", "Lambda function already created", "FUNCTION_NAME config var"],
  },
  "vercel-deploy": {
    guide: "Deploy to Vercel with preview URLs on PRs and production on merge.\n\nHow it works:\n1. Build your project (blocks on failure)\n2. Deploy to Vercel with --prod flag\n\nGenerates preview URLs for branches automatically.",
    prerequisites: ["Vercel CLI", "VERCEL_TOKEN env var", "Project linked (vercel link)"],
  },
  "netlify-deploy": {
    guide: "Deploy to Netlify with build plugins, functions, and edge handlers.\n\nHow it works:\n1. Build your project (blocks on failure)\n2. Deploy dist/ to Netlify production\n\nSupports serverless functions and edge handlers.",
    prerequisites: ["Netlify CLI (npm i -g netlify-cli)", "Netlify site configured"],
  },
  "fly-deploy": {
    guide: "Deploy containers to Fly.io edge network.\n\nHow it works:\nRuns fly deploy which builds your Dockerfile and distributes globally. Auto-scaling, HTTPS, custom domains included.",
    prerequisites: ["Fly CLI (flyctl)", "fly.toml in your repo", "Fly.io account"],
  },
  "railway-deploy": {
    guide: "One-click deploy to Railway. Auto-detects stack.\n\nHow it works:\nRailway auto-detects your framework, provisions databases, and deploys. Just run railway up.",
    prerequisites: ["Railway CLI", "Railway account", "Project linked"],
  },
  "docker-build": {
    guide: "Multi-stage Docker build with layer caching and registry push.\n\nHow it works:\n1. Build Docker image with commit SHA tag (blocks on failure)\n2. Push to your container registry\n3. Tag as latest and push again",
    prerequisites: ["Docker installed", "Registry access", "REGISTRY and IMAGE config vars"],
  },
  "helm-deploy": {
    guide: "Deploy Helm charts to Kubernetes with rollback on failure.\n\nHow it works:\nRuns helm upgrade --install with your values and waits for rollout. If deployment fails, Helm auto-rolls back.",
    prerequisites: ["Helm 3+", "kubectl configured", "RELEASE and CHART config vars"],
  },
  "terraform-apply": {
    guide: "Infrastructure as Code with plan + apply.\n\nHow it works:\n1. terraform init — initialize providers\n2. terraform plan — preview changes (blocks on error)\n3. terraform apply — apply the plan\n\nUses state locking to prevent conflicts.",
    prerequisites: ["Terraform CLI", "Cloud provider credentials", "Backend configured for state"],
  },
  "aws-ecs-deploy": {
    guide: "Deploy containers to AWS ECS with rolling updates.\n\nHow it works:\n1. Build Docker image (blocks on failure)\n2. Push to ECR\n3. Force new ECS deployment\n\nSupports Fargate and EC2 launch types.",
    prerequisites: ["AWS CLI", "Docker", "ECR_REPO, CLUSTER, SERVICE config vars"],
  },
  "gcp-cloudrun": {
    guide: "Deploy containers to Cloud Run. Auto-scaling to zero.\n\nHow it works:\n1. Cloud Build creates container image\n2. Deploy to Cloud Run with public access\n\nHTTPS and custom domains included.",
    prerequisites: ["gcloud CLI authenticated", "PROJECT_ID, SERVICE, REGION config vars"],
  },

  // --- AI ---
  "ai-review": {
    guide: "AI-powered code review on every commit.\n\nHow it works:\nSends your git diff to Claude AI. Gets back: bugs found, security issues, improvement suggestions, and a quality score.\n\nDoesn't block — adds review comments as pipeline output.",
    prerequisites: ["ANTHROPIC_API_KEY or PushCI Pro plan"],
  },
  "ai-changelog": {
    guide: "Auto-generate changelogs from commits using AI.\n\nHow it works:\nAnalyzes recent commits and generates a human-readable changelog entry with: features added, bugs fixed, breaking changes.\n\nFollows conventional commit format.",
    prerequisites: ["ANTHROPIC_API_KEY or PushCI Pro plan", "Git history available"],
  },
  "ai-test-gen": {
    guide: "Generate missing unit tests using AI.\n\nHow it works:\nFinds functions without test coverage and generates test cases. Supports Jest, Vitest, Pytest, Go testing.\n\nOutputs test files — review before committing.",
    prerequisites: ["ANTHROPIC_API_KEY or PushCI Pro plan"],
  },
  "ai-fix": {
    guide: "Automatically fix failing tests and lint errors.\n\nHow it works:\nWhen your pipeline fails, AI analyzes the error output, identifies the root cause, and generates a fix. Applied automatically if safe, or suggested as a patch.",
    prerequisites: ["ANTHROPIC_API_KEY or PushCI Pro plan"],
  },
  "ai-pr-review": {
    guide: "AI reviews every PR — catches bugs and security issues.\n\nHow it works:\nOn PR open/update, AI reviews the entire diff: logic errors, security vulnerabilities, performance issues, style problems. Posts inline comments on GitHub.",
    prerequisites: ["ANTHROPIC_API_KEY or PushCI Pro plan", "GitHub webhook configured"],
  },
  "ai-docs-gen": {
    guide: "Auto-generate documentation from changed files.\n\nHow it works:\nAI reads your code and generates: API docs, README sections, inline comments, and type documentation. Focuses on recently changed files.",
    prerequisites: ["ANTHROPIC_API_KEY or PushCI Pro plan"],
  },
  "ai-migration": {
    guide: "AI-powered framework migration assistant.\n\nHow it works:\nAnalyzes your codebase and suggests migration path: React to Next.js, Express to Hono, Jest to Vitest, etc. Generates migration steps and code patches.",
    prerequisites: ["ANTHROPIC_API_KEY or PushCI Pro plan (Premium)"],
  },
  "ai-perf-audit": {
    guide: "AI finds performance bottlenecks in your code.\n\nHow it works:\nAnalyzes your code for: N+1 queries, memory leaks, slow renders, unnecessary re-renders, large bundle imports. Provides specific fix suggestions.",
    prerequisites: ["ANTHROPIC_API_KEY or PushCI Pro plan (Premium)"],
  },
};
