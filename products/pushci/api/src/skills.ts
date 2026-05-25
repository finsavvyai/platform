import { Hono } from "hono";
import type { Env } from "./types";

export type SkillCategory =
  | "templates"
  | "checks"
  | "deploy"
  | "notify"
  | "security"
  | "ai";

export interface SkillStep {
  name: string;
  run: string;
  on_fail?: string;
}

export type SkillTier = "free" | "pro" | "premium";

export interface Skill {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  version: string;
  category: SkillCategory;
  author: string;
  tags: string[];
  verified: boolean;
  installs: number;
  tier: SkillTier;
  steps: SkillStep[];
  config?: Record<string, string>;
  gateway?: "local" | "opensyber" | "lunaos";
  guide?: string;
  prerequisites?: string[];
}

export const DEFAULT_SKILLS = ["nextjs-vercel", "secret-scan", "lint-strict", "slack-notify", "ai-review"];

const catalog: Skill[] = [
  // Templates
  {
    id: "nextjs-vercel", name: "Next.js + Vercel", version: "1.0.0",
    category: "templates", author: "pushci", verified: true, installs: 12400, tier: "free",
    description: "Full CI/CD pipeline for Next.js apps with Vercel deployment.",
    tags: ["Next.js", "Vercel", "React", "TypeScript"],
    steps: [
      { name: "Install", run: "npm ci" },
      { name: "Lint", run: "npx next lint" },
      { name: "Test", run: "npm test", on_fail: "block" },
      { name: "Build", run: "npx next build", on_fail: "block" },
      { name: "Deploy", run: "npx vercel --prod" },
    ],
  },
  {
    id: "django-aws", name: "Django + AWS", version: "1.0.0",
    category: "templates", author: "pushci", verified: true, installs: 8100, tier: "free",
    description: "Python Django pipeline with pytest and AWS ECS deployment.",
    tags: ["Python", "Django", "AWS", "ECS"],
    steps: [
      { name: "Install", run: "pip install -r requirements.txt" },
      { name: "Migrations", run: "python manage.py migrate --check" },
      { name: "Test", run: "pytest --tb=short", on_fail: "block" },
      { name: "Deploy", run: "aws ecs update-service --cluster main --service web --force-new-deployment" },
    ],
  },
  {
    id: "go-docker", name: "Go + Docker", version: "1.0.0",
    category: "templates", author: "pushci", verified: true, installs: 9700, tier: "free",
    description: "Go pipeline with race detection, Docker build, and registry push.",
    tags: ["Go", "Docker", "Kubernetes"],
    steps: [
      { name: "Vet", run: "go vet ./..." },
      { name: "Test", run: "go test -race ./...", on_fail: "block" },
      { name: "Build Image", run: "docker build -t $IMAGE:$SHA ." },
      { name: "Push Image", run: "docker push $IMAGE:$SHA" },
    ],
  },
  {
    id: "rails-fly", name: "Rails + Fly.io", version: "1.0.0",
    category: "templates", author: "community", verified: false, installs: 3200, tier: "free",
    description: "Ruby on Rails pipeline with RSpec and Fly.io deployment.",
    tags: ["Ruby", "Rails", "Fly.io", "PostgreSQL"],
    steps: [
      { name: "Install", run: "bundle install" },
      { name: "DB Setup", run: "bin/rails db:test:prepare" },
      { name: "Test", run: "bundle exec rspec", on_fail: "block" },
      { name: "Deploy", run: "fly deploy" },
    ],
  },
  {
    id: "rust-shuttle", name: "Rust + Shuttle", version: "1.0.0",
    category: "templates", author: "community", verified: false, installs: 2800, tier: "free",
    description: "Rust pipeline with clippy linting and Shuttle.rs deployment.",
    tags: ["Rust", "Shuttle", "Actix", "Axum"],
    steps: [
      { name: "Clippy", run: "cargo clippy -- -D warnings" },
      { name: "Test", run: "cargo test", on_fail: "block" },
      { name: "Deploy", run: "cargo shuttle deploy" },
    ],
  },
  {
    id: "flutter-firebase", name: "Flutter + Firebase", version: "1.0.0",
    category: "templates", author: "pushci", verified: true, installs: 5600, tier: "free",
    description: "Flutter pipeline with widget tests and Firebase App Distribution.",
    tags: ["Dart", "Flutter", "Firebase", "Mobile"],
    steps: [
      { name: "Get Deps", run: "flutter pub get" },
      { name: "Analyze", run: "flutter analyze" },
      { name: "Test", run: "flutter test", on_fail: "block" },
      { name: "Build", run: "flutter build apk --release" },
      { name: "Distribute", run: "firebase appdistribution:distribute build/app/outputs/flutter-apk/app-release.apk" },
    ],
  },
  // Security
  {
    id: "secret-scan", name: "Secret Scanner", version: "1.0.0",
    category: "security", author: "pushci", verified: true, installs: 18300, tier: "free",
    description: "Scan code for leaked API keys, tokens, and private keys.",
    tags: ["Security", "Secrets", "API Keys", "Pre-commit"],
    steps: [{ name: "Scan Secrets", run: "pushci scan --secrets", on_fail: "block" }],
  },
  {
    id: "license-check", name: "License Checker", version: "1.0.0",
    category: "security", author: "community", verified: false, installs: 4100, tier: "pro",
    description: "Verify all dependencies use approved licenses.",
    tags: ["License", "Compliance", "SBOM", "Legal"],
    steps: [{ name: "Check Licenses", run: "license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC'", on_fail: "block" }],
  },
  {
    id: "sbom-gen", name: "SBOM Generator", version: "1.0.0",
    category: "security", author: "pushci", verified: true, installs: 6900, tier: "pro",
    description: "Generate Software Bill of Materials in CycloneDX format.",
    tags: ["SBOM", "CycloneDX", "SPDX", "Supply Chain"],
    steps: [{ name: "Generate SBOM", run: "cyclonedx-bom -o sbom.json" }],
  },
  {
    id: "vulnerability-scan", name: "Dependency Audit", version: "1.0.0",
    category: "security", author: "pushci", verified: true, installs: 11200, tier: "pro",
    description: "Scan dependencies for known CVEs. Block on critical vulns.",
    tags: ["CVE", "Vulnerability", "npm audit", "Safety"],
    steps: [{ name: "Audit Deps", run: "pushci scan --vulnerabilities", on_fail: "block" }],
  },
  // Notifications
  {
    id: "slack-notify", name: "Slack Notifications", version: "1.0.0",
    category: "notify", author: "pushci", verified: true, installs: 14700, tier: "free",
    description: "Post build results to Slack channels with rich formatting.",
    tags: ["Slack", "Notifications", "Chat"],
    steps: [{ name: "Notify Slack", run: "pushci notify --slack $SLACK_WEBHOOK_URL" }],
    config: { SLACK_WEBHOOK_URL: "" },
  },
  {
    id: "discord-notify", name: "Discord Notifications", version: "1.0.0",
    category: "notify", author: "community", verified: false, installs: 7300, tier: "free",
    description: "Send build status embeds to Discord channels.",
    tags: ["Discord", "Notifications", "Webhooks"],
    steps: [{ name: "Notify Discord", run: "pushci notify --discord $DISCORD_WEBHOOK_URL" }],
    config: { DISCORD_WEBHOOK_URL: "" },
  },
  {
    id: "email-digest", name: "Email Digest", version: "1.0.0",
    category: "notify", author: "community", verified: false, installs: 2100, tier: "free",
    description: "Daily email summary of pipeline runs and failures.",
    tags: ["Email", "Digest", "Summary"],
    steps: [{ name: "Send Digest", run: "pushci notify --email $NOTIFY_EMAIL" }],
    config: { NOTIFY_EMAIL: "" },
  },
  // Deploy
  {
    id: "cloudflare-deploy", name: "Cloudflare Pages", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 10800, tier: "free",
    description: "Deploy static sites and SSR apps to Cloudflare Pages.",
    tags: ["Cloudflare", "Pages", "Workers", "Edge"],
    steps: [
      { name: "Build", run: "npm run build" },
      { name: "Deploy", run: "npx wrangler pages deploy dist --project-name $PROJECT_NAME" },
    ],
    config: { PROJECT_NAME: "" },
  },
  {
    id: "k8s-deploy", name: "Kubernetes Deploy", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 8400, tier: "pro",
    description: "Rolling deployment to Kubernetes with health checks.",
    tags: ["Kubernetes", "K8s", "Helm", "Rolling Deploy"],
    steps: [
      { name: "Apply", run: "kubectl apply -f k8s/" },
      { name: "Rollout Wait", run: "kubectl rollout status deployment/$DEPLOY_NAME --timeout=300s" },
    ],
    config: { DEPLOY_NAME: "" },
  },
  {
    id: "aws-lambda", name: "AWS Lambda Deploy", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 6200, tier: "pro",
    description: "Package and deploy serverless functions to AWS Lambda.",
    tags: ["AWS", "Lambda", "Serverless", "API Gateway"],
    steps: [
      { name: "Package", run: "zip -r function.zip ." },
      { name: "Deploy", run: "aws lambda update-function-code --function-name $FUNCTION_NAME --zip-file fileb://function.zip" },
    ],
    config: { FUNCTION_NAME: "" },
  },
  // Checks
  {
    id: "lint-strict", name: "Strict Linting", version: "1.0.0",
    category: "checks", author: "pushci", verified: true, installs: 13100, tier: "free",
    description: "Enforce linter with zero-tolerance for warnings.",
    tags: ["Lint", "ESLint", "Pylint", "Code Quality"],
    steps: [{ name: "Lint", run: "pushci lint --strict", on_fail: "block" }],
  },
  {
    id: "coverage-gate", name: "Coverage Gate", version: "1.0.0",
    category: "checks", author: "pushci", verified: true, installs: 9800, tier: "free",
    description: "Fail builds if test coverage drops below threshold.",
    tags: ["Coverage", "Testing", "Quality Gate"],
    steps: [{ name: "Check Coverage", run: "pushci coverage --min 80", on_fail: "block" }],
    config: { MIN_COVERAGE: "80" },
  },
  {
    id: "bundle-size", name: "Bundle Size Check", version: "1.0.0",
    category: "checks", author: "community", verified: false, installs: 5400, tier: "pro",
    description: "Track JavaScript bundle size. Fail if beyond threshold.",
    tags: ["Bundle", "Performance", "Webpack", "Vite"],
    steps: [{ name: "Check Bundle", run: "npx size-limit", on_fail: "block" }],
  },
  {
    id: "lighthouse", name: "Lighthouse CI", version: "1.0.0",
    category: "checks", author: "community", verified: false, installs: 4700, tier: "pro",
    description: "Run Google Lighthouse audits on every build.",
    tags: ["Lighthouse", "Performance", "A11y", "SEO"],
    steps: [{ name: "Lighthouse", run: "npx @lhci/cli autorun" }],
  },
  // AI-Powered
  {
    id: "ai-review", name: "AI Code Review", version: "1.0.0",
    category: "ai", author: "pushci", verified: true, installs: 15900, tier: "pro",
    description: "AI-powered code review that catches bugs and suggests improvements.",
    tags: ["AI", "Code Review", "Claude", "Quality"],
    steps: [{ name: "AI Review", run: "pushci ask 'review the changes in this commit for bugs and improvements'" }],
  },
  {
    id: "ai-changelog", name: "AI Changelog", version: "1.0.0",
    category: "ai", author: "pushci", verified: true, installs: 7600, tier: "pro",
    description: "Auto-generate changelogs from commits using AI.",
    tags: ["AI", "Changelog", "Semver", "Release"],
    steps: [{ name: "Generate Changelog", run: "pushci ask 'generate a changelog entry for the latest commits'" }],
  },
  {
    id: "ai-test-gen", name: "AI Test Generator", version: "1.0.0",
    category: "ai", author: "pushci", verified: true, installs: 11300, tier: "pro",
    description: "Generate missing unit tests using AI.",
    tags: ["AI", "Testing", "Unit Tests", "Coverage"],
    steps: [{ name: "Generate Tests", run: "pushci ask 'generate unit tests for uncovered functions'" }],
  },
  {
    id: "ai-fix", name: "AI Auto-Fix", version: "1.0.0",
    category: "ai", author: "pushci", verified: true, installs: 9100, tier: "pro",
    description: "Automatically fix failing tests and lint errors using AI.",
    tags: ["AI", "Auto-fix", "Self-healing", "Pipeline"],
    steps: [{ name: "Auto Fix", run: "pushci heal" }],
  },
  // --- Security & Compliance ---
  {
    id: "trivy-scan", name: "Trivy Container Scan", version: "1.0.0",
    category: "security", author: "pushci", verified: true, installs: 16800, tier: "free",
    description: "Scan container images and filesystems for vulnerabilities, misconfigurations, and secrets using Trivy.",
    tags: ["Trivy", "Container", "CVE", "Docker", "SBOM"],
    steps: [
      { name: "Scan Image", run: "trivy image --severity HIGH,CRITICAL --exit-code 1 $IMAGE", on_fail: "block" },
      { name: "Scan Filesystem", run: "trivy fs --severity HIGH,CRITICAL ." },
    ],
    config: { IMAGE: "" },
  },
  {
    id: "snyk-scan", name: "Snyk Security", version: "1.0.0",
    category: "security", author: "pushci", verified: true, installs: 14200, tier: "pro",
    description: "Scan code, dependencies, containers, and IaC for vulnerabilities with Snyk.",
    tags: ["Snyk", "Security", "SCA", "SAST", "IaC"],
    steps: [
      { name: "Test Deps", run: "snyk test --severity-threshold=high", on_fail: "block" },
      { name: "Test Code", run: "snyk code test" },
      { name: "Monitor", run: "snyk monitor" },
    ],
  },
  {
    id: "semgrep", name: "Semgrep SAST", version: "1.0.0",
    category: "security", author: "pushci", verified: true, installs: 11500, tier: "pro",
    description: "Static analysis with Semgrep — OWASP Top 10, injection, XSS, hardcoded secrets. 2000+ rules.",
    tags: ["Semgrep", "SAST", "OWASP", "Static Analysis"],
    steps: [{ name: "Semgrep Scan", run: "semgrep scan --config=auto --error --severity ERROR", on_fail: "block" }],
  },
  {
    id: "gitleaks", name: "Gitleaks Secret Detection", version: "1.0.0",
    category: "security", author: "community", verified: true, installs: 13400, tier: "free",
    description: "Detect hardcoded secrets in git history — API keys, passwords, tokens. Scans all commits.",
    tags: ["Gitleaks", "Secrets", "Git History", "Pre-commit"],
    steps: [{ name: "Gitleaks", run: "gitleaks detect --source . --exit-code 1", on_fail: "block" }],
  },
  {
    id: "checkov", name: "Checkov IaC Scanner", version: "1.0.0",
    category: "security", author: "community", verified: true, installs: 8700, tier: "pro",
    description: "Scan Terraform, CloudFormation, Kubernetes, Dockerfile for misconfigurations.",
    tags: ["Checkov", "IaC", "Terraform", "CloudFormation", "K8s"],
    steps: [{ name: "Checkov Scan", run: "checkov -d . --framework terraform,cloudformation,kubernetes,dockerfile", on_fail: "block" }],
  },
  {
    id: "zap-scan", name: "OWASP ZAP DAST", version: "1.0.0",
    category: "security", author: "pushci", verified: true, installs: 7200, tier: "premium",
    description: "Dynamic Application Security Testing with OWASP ZAP. Scan running apps for XSS, SQLi, CSRF.",
    tags: ["ZAP", "DAST", "OWASP", "Penetration Testing"],
    steps: [
      { name: "ZAP Baseline", run: "docker run -t zaproxy/zap-stable zap-baseline.py -t $TARGET_URL", on_fail: "block" },
    ],
    config: { TARGET_URL: "" },
  },
  {
    id: "grype", name: "Grype Vulnerability Scan", version: "1.0.0",
    category: "security", author: "community", verified: true, installs: 9100, tier: "free",
    description: "Fast vulnerability scanner for container images and filesystems. Anchore-powered.",
    tags: ["Grype", "Anchore", "Vulnerability", "Container"],
    steps: [{ name: "Grype Scan", run: "grype dir:. --fail-on high", on_fail: "block" }],
  },
  // --- Testing ---
  {
    id: "playwright-e2e", name: "Playwright E2E", version: "1.0.0",
    category: "checks", author: "pushci", verified: true, installs: 19200, tier: "free",
    description: "Cross-browser E2E testing with Playwright. Chrome, Firefox, Safari. Screenshots on failure.",
    tags: ["Playwright", "E2E", "Browser", "Cross-browser"],
    steps: [
      { name: "Install Browsers", run: "npx playwright install --with-deps" },
      { name: "Run E2E", run: "npx playwright test", on_fail: "block" },
      { name: "Report", run: "npx playwright show-report --host 0.0.0.0" },
    ],
  },
  {
    id: "cypress-e2e", name: "Cypress E2E", version: "1.0.0",
    category: "checks", author: "community", verified: true, installs: 15600, tier: "free",
    description: "Component and E2E testing with Cypress. Visual debugging, time travel, auto-retry.",
    tags: ["Cypress", "E2E", "Component Testing", "Browser"],
    steps: [
      { name: "Run Cypress", run: "npx cypress run", on_fail: "block" },
    ],
  },
  {
    id: "vitest", name: "Vitest Unit Tests", version: "1.0.0",
    category: "checks", author: "pushci", verified: true, installs: 17800, tier: "free",
    description: "Blazing fast unit tests with Vitest. Native ESM, TypeScript, JSX. Compatible with Jest.",
    tags: ["Vitest", "Unit Test", "TypeScript", "Jest Compatible"],
    steps: [
      { name: "Run Tests", run: "npx vitest run", on_fail: "block" },
      { name: "Coverage", run: "npx vitest run --coverage" },
    ],
  },
  {
    id: "jest", name: "Jest Test Suite", version: "1.0.0",
    category: "checks", author: "community", verified: true, installs: 21400, tier: "free",
    description: "The standard JavaScript test framework. Snapshot testing, mocking, coverage built-in.",
    tags: ["Jest", "Unit Test", "Snapshot", "Mocking"],
    steps: [
      { name: "Run Tests", run: "npx jest --ci --coverage", on_fail: "block" },
    ],
  },
  {
    id: "pytest", name: "Pytest Suite", version: "1.0.0",
    category: "checks", author: "community", verified: true, installs: 14300, tier: "free",
    description: "Python testing with pytest — fixtures, parametrize, plugins. Coverage with pytest-cov.",
    tags: ["Python", "Pytest", "Coverage", "Fixtures"],
    steps: [
      { name: "Run Pytest", run: "pytest --tb=short --cov=. --cov-report=term-missing", on_fail: "block" },
    ],
  },
  {
    id: "go-test", name: "Go Test + Race", version: "1.0.0",
    category: "checks", author: "pushci", verified: true, installs: 12800, tier: "free",
    description: "Go test suite with race detection, coverage, and vet. Catches data races before production.",
    tags: ["Go", "Race Detection", "Coverage", "Vet"],
    steps: [
      { name: "Vet", run: "go vet ./..." },
      { name: "Test", run: "go test -race -cover ./...", on_fail: "block" },
    ],
  },
  // --- Code Quality ---
  {
    id: "eslint-strict", name: "ESLint Strict", version: "1.0.0",
    category: "checks", author: "pushci", verified: true, installs: 18900, tier: "free",
    description: "Zero-tolerance ESLint — no warnings, no errors. Supports TypeScript, React, Vue.",
    tags: ["ESLint", "Lint", "TypeScript", "Code Quality"],
    steps: [{ name: "ESLint", run: "npx eslint . --max-warnings 0", on_fail: "block" }],
  },
  {
    id: "prettier-check", name: "Prettier Format Check", version: "1.0.0",
    category: "checks", author: "community", verified: true, installs: 16200, tier: "free",
    description: "Verify code formatting matches Prettier config. Fails if unformatted files found.",
    tags: ["Prettier", "Format", "Code Style", "Consistency"],
    steps: [{ name: "Prettier Check", run: "npx prettier --check .", on_fail: "block" }],
  },
  {
    id: "biome", name: "Biome Lint + Format", version: "1.0.0",
    category: "checks", author: "community", verified: true, installs: 8400, tier: "free",
    description: "Ultra-fast linter and formatter. Replaces ESLint + Prettier in one tool. Rust-powered.",
    tags: ["Biome", "Lint", "Format", "Rust", "Fast"],
    steps: [{ name: "Biome Check", run: "npx @biomejs/biome check .", on_fail: "block" }],
  },
  {
    id: "sonarqube", name: "SonarQube Analysis", version: "1.0.0",
    category: "checks", author: "pushci", verified: true, installs: 10300, tier: "pro",
    description: "Deep code quality analysis — bugs, vulnerabilities, code smells, tech debt, duplications.",
    tags: ["SonarQube", "Code Quality", "Tech Debt", "SAST"],
    steps: [{ name: "Sonar Scan", run: "sonar-scanner -Dsonar.projectKey=$PROJECT_KEY", on_fail: "block" }],
    config: { PROJECT_KEY: "", SONAR_TOKEN: "", SONAR_HOST_URL: "" },
  },
  {
    id: "depcheck", name: "Unused Dependencies", version: "1.0.0",
    category: "checks", author: "community", verified: true, installs: 7600, tier: "free",
    description: "Find unused dependencies in your project. Clean up package.json bloat.",
    tags: ["Depcheck", "Dependencies", "Cleanup", "Bundle Size"],
    steps: [{ name: "Depcheck", run: "npx depcheck", on_fail: "block" }],
  },
  // --- Deploy Targets ---
  {
    id: "vercel-deploy", name: "Vercel Deploy", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 13700, tier: "free",
    description: "Deploy to Vercel with preview URLs on PRs and production on merge.",
    tags: ["Vercel", "Preview", "Serverless", "Edge"],
    steps: [
      { name: "Build", run: "npm run build", on_fail: "block" },
      { name: "Deploy", run: "npx vercel --prod --token $VERCEL_TOKEN" },
    ],
    config: { VERCEL_TOKEN: "" },
  },
  {
    id: "netlify-deploy", name: "Netlify Deploy", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 11200, tier: "free",
    description: "Deploy to Netlify with build plugins, functions, and edge handlers.",
    tags: ["Netlify", "Functions", "Edge", "JAMstack"],
    steps: [
      { name: "Build", run: "npm run build", on_fail: "block" },
      { name: "Deploy", run: "npx netlify deploy --prod --dir=dist" },
    ],
  },
  {
    id: "fly-deploy", name: "Fly.io Deploy", version: "1.0.0",
    category: "deploy", author: "community", verified: true, installs: 8900, tier: "free",
    description: "Deploy containers to Fly.io edge network. Auto-scaling, global distribution.",
    tags: ["Fly.io", "Container", "Edge", "Global"],
    steps: [{ name: "Deploy", run: "fly deploy --ha=false" }],
  },
  {
    id: "railway-deploy", name: "Railway Deploy", version: "1.0.0",
    category: "deploy", author: "community", verified: true, installs: 7400, tier: "free",
    description: "One-click deploy to Railway. Auto-detects stack, provisions databases.",
    tags: ["Railway", "PaaS", "Database", "Auto-detect"],
    steps: [{ name: "Deploy", run: "railway up" }],
  },
  {
    id: "docker-build", name: "Docker Build + Push", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 15300, tier: "free",
    description: "Multi-stage Docker build with layer caching. Push to any registry.",
    tags: ["Docker", "Registry", "Multi-stage", "Cache"],
    steps: [
      { name: "Build", run: "docker build -t $REGISTRY/$IMAGE:$SHA .", on_fail: "block" },
      { name: "Push", run: "docker push $REGISTRY/$IMAGE:$SHA" },
      { name: "Tag Latest", run: "docker tag $REGISTRY/$IMAGE:$SHA $REGISTRY/$IMAGE:latest && docker push $REGISTRY/$IMAGE:latest" },
    ],
    config: { REGISTRY: "", IMAGE: "" },
  },
  {
    id: "helm-deploy", name: "Helm Chart Deploy", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 6800, tier: "pro",
    description: "Deploy Helm charts to Kubernetes with value overrides and rollback on failure.",
    tags: ["Helm", "Kubernetes", "Charts", "Rollback"],
    steps: [
      { name: "Helm Upgrade", run: "helm upgrade --install $RELEASE $CHART --set image.tag=$SHA --wait --timeout 5m", on_fail: "block" },
    ],
    config: { RELEASE: "", CHART: "" },
  },
  {
    id: "terraform-apply", name: "Terraform Apply", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 9500, tier: "pro",
    description: "Infrastructure as Code with Terraform. Plan, apply, and destroy with state locking.",
    tags: ["Terraform", "IaC", "Infrastructure", "AWS", "GCP"],
    steps: [
      { name: "Init", run: "terraform init" },
      { name: "Plan", run: "terraform plan -out=tfplan", on_fail: "block" },
      { name: "Apply", run: "terraform apply -auto-approve tfplan" },
    ],
  },
  {
    id: "aws-ecs-deploy", name: "AWS ECS Deploy", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 8200, tier: "pro",
    description: "Deploy containers to AWS ECS with rolling updates. Supports Fargate and EC2.",
    tags: ["AWS", "ECS", "Fargate", "Container", "Rolling Update"],
    steps: [
      { name: "Build", run: "docker build -t $ECR_REPO:$SHA .", on_fail: "block" },
      { name: "Push to ECR", run: "aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REPO && docker push $ECR_REPO:$SHA" },
      { name: "Update Service", run: "aws ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment" },
    ],
    config: { ECR_REPO: "", CLUSTER: "", SERVICE: "" },
  },
  {
    id: "gcp-cloudrun", name: "GCP Cloud Run Deploy", version: "1.0.0",
    category: "deploy", author: "pushci", verified: true, installs: 7100, tier: "pro",
    description: "Deploy containers to Cloud Run. Auto-scaling to zero, HTTPS, custom domains.",
    tags: ["GCP", "Cloud Run", "Serverless", "Container"],
    steps: [
      { name: "Build", run: "gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE" },
      { name: "Deploy", run: "gcloud run deploy $SERVICE --image gcr.io/$PROJECT_ID/$SERVICE --region $REGION --allow-unauthenticated" },
    ],
    config: { PROJECT_ID: "", SERVICE: "", REGION: "us-central1" },
  },
  // --- Notifications ---
  {
    id: "teams-notify", name: "Microsoft Teams", version: "1.0.0",
    category: "notify", author: "community", verified: true, installs: 6200, tier: "free",
    description: "Send build status cards to Microsoft Teams channels via webhook.",
    tags: ["Teams", "Microsoft", "Notifications", "Webhook"],
    steps: [{ name: "Notify Teams", run: "pushci notify --teams $TEAMS_WEBHOOK_URL" }],
    config: { TEAMS_WEBHOOK_URL: "" },
  },
  {
    id: "pagerduty-alert", name: "PagerDuty Alerts", version: "1.0.0",
    category: "notify", author: "pushci", verified: true, installs: 4800, tier: "pro",
    description: "Trigger PagerDuty incidents on pipeline failures. Auto-resolve on success.",
    tags: ["PagerDuty", "Alerting", "Incident", "On-call"],
    steps: [{ name: "PagerDuty", run: "pushci notify --pagerduty $PD_ROUTING_KEY" }],
    config: { PD_ROUTING_KEY: "" },
  },
  {
    id: "datadog-events", name: "Datadog CI Events", version: "1.0.0",
    category: "notify", author: "pushci", verified: true, installs: 5400, tier: "pro",
    description: "Send CI/CD events to Datadog. Track deployments, build metrics, and failure rates.",
    tags: ["Datadog", "Monitoring", "APM", "Events"],
    steps: [{ name: "Send Event", run: "pushci notify --datadog $DD_API_KEY" }],
    config: { DD_API_KEY: "" },
  },
  // --- AI-Powered ---
  {
    id: "ai-pr-review", name: "AI PR Reviewer", version: "1.0.0",
    category: "ai", author: "pushci", verified: true, installs: 12600, tier: "pro",
    description: "AI reviews every PR — catches bugs, security issues, and suggests improvements. Posts comments on GitHub.",
    tags: ["AI", "PR Review", "Code Review", "GitHub"],
    steps: [{ name: "AI Review PR", run: "pushci ask 'review this PR diff for bugs, security issues, and improvements'" }],
  },
  {
    id: "ai-docs-gen", name: "AI Documentation", version: "1.0.0",
    category: "ai", author: "pushci", verified: true, installs: 8900, tier: "pro",
    description: "Auto-generate API docs, README, changelogs, and inline comments using AI.",
    tags: ["AI", "Documentation", "README", "API Docs"],
    steps: [{ name: "Generate Docs", run: "pushci ask 'generate documentation for changed files'" }],
  },
  {
    id: "ai-migration", name: "AI Migration Helper", version: "1.0.0",
    category: "ai", author: "pushci", verified: true, installs: 5200, tier: "premium",
    description: "AI-powered framework migration — React to Next.js, Express to Hono, Jest to Vitest.",
    tags: ["AI", "Migration", "Framework", "Upgrade"],
    steps: [{ name: "Analyze", run: "pushci ask 'analyze this codebase and suggest migration path'" }],
  },
  {
    id: "ai-perf-audit", name: "AI Performance Audit", version: "1.0.0",
    category: "ai", author: "pushci", verified: true, installs: 6700, tier: "premium",
    description: "AI analyzes your code for performance bottlenecks — N+1 queries, memory leaks, slow renders.",
    tags: ["AI", "Performance", "Optimization", "Profiling"],
    steps: [{ name: "Perf Audit", run: "pushci ask 'find performance bottlenecks in this codebase'" }],
  },
  // --- Autoboot (FastPM) Skills — real commands from package.json ---
  {
    id: "autoboot-fullci", name: "Autoboot Full CI", version: "1.0.0",
    category: "templates", author: "finsavvyai", verified: true, installs: 4200, tier: "premium",
    description: "Complete CI pipeline for MCP/Node.js projects. Typecheck, lint, unit tests, integration tests, coverage gate.",
    tags: ["Autoboot", "FastPM", "MCP", "TypeScript", "Node.js"],
    steps: [
      { name: "Install", run: "npm ci" },
      { name: "Typecheck", run: "npm run typecheck", on_fail: "block" },
      { name: "Lint", run: "npm run lint", on_fail: "block" },
      { name: "Unit Tests", run: "npm run test:unit", on_fail: "block" },
      { name: "Integration", run: "npm run test:integration" },
      { name: "Coverage", run: "npm run test:coverage", on_fail: "block" },
    ],
  },
  {
    id: "autoboot-deploy", name: "Autoboot Netlify Deploy", version: "1.0.0",
    category: "deploy", author: "finsavvyai", verified: true, installs: 3800, tier: "premium",
    description: "Deploy MCP servers to Netlify with pre-deploy validation, health checks, and staging/production stages.",
    tags: ["Autoboot", "Netlify", "Deploy", "Staging"],
    steps: [
      { name: "Validate", run: "npm run validate" },
      { name: "Pre-deploy", run: "npm run pre-deploy" },
      { name: "Build", run: "npm run build:netlify" },
      { name: "Deploy Staging", run: "npm run deploy:staging" },
      { name: "Health Check", run: "npm run health-check" },
      { name: "Deploy Prod", run: "npm run deploy" },
    ],
  },
  {
    id: "autoboot-security", name: "Autoboot Security Suite", version: "1.0.0",
    category: "security", author: "finsavvyai", verified: true, installs: 2900, tier: "premium",
    description: "Security + performance + load testing suite. Runs SAST, dependency audit, and load tests.",
    tags: ["Autoboot", "Security", "Load Test", "Performance"],
    steps: [
      { name: "Security Scan", run: "npm run test:security", on_fail: "block" },
      { name: "Performance", run: "npm run test:performance" },
      { name: "Load Test", run: "npm run test:load" },
    ],
  },
  // --- DevWrapped Skills — real commands from package.json ---
  {
    id: "devwrapped-fullci", name: "DevWrapped Full CI", version: "1.0.0",
    category: "templates", author: "finsavvyai", verified: true, installs: 6300, tier: "premium",
    description: "Full React + Supabase CI pipeline. Typecheck, lint, unit tests, integration tests, E2E with Playwright, coverage.",
    tags: ["DevWrapped", "React", "Supabase", "Playwright", "Vitest"],
    steps: [
      { name: "Install", run: "npm ci" },
      { name: "Typecheck", run: "npm run typecheck", on_fail: "block" },
      { name: "Lint", run: "npm run lint", on_fail: "block" },
      { name: "Unit Tests", run: "npm run test:unit", on_fail: "block" },
      { name: "Integration", run: "npm run test:integration" },
      { name: "E2E Tests", run: "npm run test:e2e", on_fail: "block" },
      { name: "Coverage", run: "npm run test:coverage" },
    ],
  },
  {
    id: "devwrapped-deploy", name: "DevWrapped Multi-Target Deploy", version: "1.0.0",
    category: "deploy", author: "finsavvyai", verified: true, installs: 4700, tier: "premium",
    description: "Deploy to Vercel, Netlify, or Docker. Includes DB migrations, smoke tests, and production validation.",
    tags: ["DevWrapped", "Vercel", "Netlify", "Docker", "Supabase"],
    steps: [
      { name: "Validate", run: "npm run validate" },
      { name: "Build", run: "npm run build:prod", on_fail: "block" },
      { name: "DB Migrate", run: "npm run db:migrate" },
      { name: "Smoke Test", run: "npm run test:smoke", on_fail: "block" },
    ],
  },
  {
    id: "devwrapped-docker", name: "DevWrapped Docker Stack", version: "1.0.0",
    category: "deploy", author: "finsavvyai", verified: true, installs: 3200, tier: "premium",
    description: "Full Docker Compose stack — app + Supabase + monitoring. Multi-stage Dockerfile with optimized layers.",
    tags: ["DevWrapped", "Docker", "Compose", "Supabase", "Monitoring"],
    steps: [
      { name: "Build Image", run: "docker build -t devwrapped:latest ." },
      { name: "Start Stack", run: "docker compose up -d" },
      { name: "Health Check", run: "curl -sf http://localhost:3000/health" },
    ],
  },
  {
    id: "devwrapped-bundle", name: "Bundle Size Analyzer", version: "1.0.0",
    category: "checks", author: "finsavvyai", verified: true, installs: 2800, tier: "premium",
    description: "Analyze Vite bundle size with visualizer. Catches bloated dependencies before deploy.",
    tags: ["DevWrapped", "Bundle Size", "Vite", "Performance"],
    steps: [
      { name: "Build + Analyze", run: "npm run build:analyze", on_fail: "block" },
    ],
  },
  // --- CodeRailFlow Skills — real commands from package.json ---
  {
    id: "coderailflow-fullci", name: "CodeRailFlow Full CI", version: "1.0.0",
    category: "templates", author: "finsavvyai", verified: true, installs: 5800, tier: "premium",
    description: "Full pnpm monorepo CI — typecheck, lint, unit tests, E2E with Playwright (headed + UI modes), coverage.",
    tags: ["CodeRailFlow", "pnpm", "Monorepo", "Playwright", "Vitest"],
    steps: [
      { name: "Install", run: "pnpm install --frozen-lockfile" },
      { name: "Typecheck", run: "pnpm typecheck", on_fail: "block" },
      { name: "Lint", run: "pnpm lint", on_fail: "block" },
      { name: "Unit Tests", run: "pnpm test", on_fail: "block" },
      { name: "E2E Tests", run: "pnpm test:e2e", on_fail: "block" },
      { name: "Coverage", run: "pnpm test:coverage" },
    ],
  },
  {
    id: "coderailflow-edge-deploy", name: "Cloudflare Edge Deploy", version: "1.0.0",
    category: "deploy", author: "finsavvyai", verified: true, installs: 4100, tier: "premium",
    description: "Deploy Workers + D1 + R2 to Cloudflare edge. Runs 13 D1 migrations, deploys API and web separately.",
    tags: ["CodeRailFlow", "Cloudflare", "Workers", "D1", "R2", "Edge"],
    steps: [
      { name: "Build Web", run: "pnpm build:web", on_fail: "block" },
      { name: "Deploy API", run: "pnpm deploy:api" },
      { name: "Deploy Web", run: "pnpm deploy:web" },
    ],
  },
  {
    id: "coderailflow-production", name: "Production Validation", version: "1.0.0",
    category: "checks", author: "finsavvyai", verified: true, installs: 3600, tier: "premium",
    description: "Full production validation — security verification, penetration testing, E2E against prod, performance benchmarks.",
    tags: ["CodeRailFlow", "Production", "Security", "Pentest", "Benchmark"],
    steps: [
      { name: "Validate Prod", run: "pnpm validate:production", on_fail: "block" },
      { name: "Security Verify", run: "pnpm security:verify", on_fail: "block" },
      { name: "E2E Prod", run: "pnpm test:e2e:production" },
      { name: "Benchmark", run: "pnpm perf:benchmark" },
    ],
  },
  {
    id: "coderailflow-e2e-visual", name: "Visual E2E Testing", version: "1.0.0",
    category: "checks", author: "finsavvyai", verified: true, installs: 2400, tier: "premium",
    description: "Playwright E2E with headed mode, UI mode, and visual reports. Interactive debugging for flaky tests.",
    tags: ["CodeRailFlow", "Playwright", "E2E", "Visual", "Headed"],
    steps: [
      { name: "E2E Headed", run: "pnpm test:e2e:headed" },
      { name: "E2E Report", run: "pnpm test:e2e:report" },
    ],
  },
];

function matchesQuery(skill: Skill, query: string): boolean {
  const q = query.toLowerCase();
  if (skill.name.toLowerCase().includes(q)) return true;
  if (skill.description.toLowerCase().includes(q)) return true;
  if (skill.category.toLowerCase().includes(q)) return true;
  return skill.tags.some((t) => t.toLowerCase().includes(q));
}

import { SKILL_GUIDES } from "./skill-guides";

function enrichWithGuide(skill: Skill): Skill {
  const guide = SKILL_GUIDES[skill.id];
  if (!guide) return skill;
  return { ...skill, guide: guide.guide, prerequisites: guide.prerequisites };
}

export function getSkillCatalog(): Skill[] {
  return catalog.map(enrichWithGuide);
}

export function getSkillById(id: string): Skill | undefined {
  const skill = catalog.find((s) => s.id === id);
  return skill ? enrichWithGuide(skill) : undefined;
}

export function searchSkills(query: string): Skill[] {
  if (!query) return catalog;
  return catalog.filter((s) => matchesQuery(s, query));
}

export function listSkillsByCategory(category: SkillCategory): Skill[] {
  return catalog.filter((s) => s.category === category);
}

type Bindings = Env;
export const skillRoutes = new Hono<{ Bindings: Bindings }>();

// GET /api/skills — list all or filter by category/query
skillRoutes.get("/", (c) => {
  const category = c.req.query("category") as SkillCategory | undefined;
  const query = c.req.query("q");

  let results: Skill[];
  if (query) {
    results = searchSkills(query);
    if (category) {
      results = results.filter((s) => s.category === category);
    }
  } else if (category) {
    results = listSkillsByCategory(category);
  } else {
    results = getSkillCatalog();
  }

  return c.json({
    skills: results,
    total: results.length,
    categories: ["templates", "checks", "deploy", "notify", "security", "ai"],
  });
});

// GET /api/skills/:id — get a single skill by ID
skillRoutes.get("/:id", (c) => {
  const skill = getSkillById(c.req.param("id"));
  if (!skill) return c.json({ error: "skill not found" }, 404);
  return c.json({ skill });
});

// GET /api/skills/categories/summary — category counts
skillRoutes.get("/categories/summary", (c) => {
  const counts: Record<string, number> = {};
  for (const s of catalog) {
    counts[s.category] = (counts[s.category] || 0) + 1;
  }
  return c.json({ categories: counts, total: catalog.length });
});

// POST /api/skills/:id/install — install a skill to a project
skillRoutes.post("/:id/install", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const { verifyJwt } = await import("./auth");
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const skillId = c.req.param("id");
  const skill = getSkillById(skillId);
  if (!skill) return c.json({ error: "skill not found" }, 404);

  const body = await c.req.json<{ project_id: string }>();
  if (!body.project_id) return c.json({ error: "project_id required" }, 400);

  // Verify project membership
  const membership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(body.project_id, user.sub).first();
  if (!membership) return c.json({ error: "forbidden" }, 403);

  // Store installed skill in KV (project_id -> skill_ids[])
  const key = `skills:${body.project_id}`;
  const existing = await c.env.RUNNERS.get(key);
  const installed: string[] = existing ? JSON.parse(existing) : [];
  if (!installed.includes(skillId)) {
    installed.push(skillId);
    await c.env.RUNNERS.put(key, JSON.stringify(installed));
  }

  return c.json({ ok: true, skill: skill.name, project_id: body.project_id, installed_skills: installed });
});

// GET /api/skills/installed/:projectId — list installed skills for a project
skillRoutes.get("/installed/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const { verifyJwt } = await import("./auth");
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const membership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(projectId, user.sub).first();
  if (!membership) return c.json({ error: "forbidden" }, 403);

  const key = `skills:${projectId}`;
  const existing = await c.env.RUNNERS.get(key);
  const ids: string[] = existing ? JSON.parse(existing) : [];
  const skills = ids.map(id => getSkillById(id)).filter(Boolean);

  return c.json({ skills, project_id: projectId });
});
