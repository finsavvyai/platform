// Registry template translators: generic CompanyRegistry -> settings
// file snippets for Maven, Gradle, Docker and npm. This is the layer
// that REPLACES Stream D's hardcoded Nexus block — downstream callers
// should prefer these functions over touching `maven-settings.ts`
// directly. Pure string builders, no I/O, deterministic output so we
// can snapshot-test them.

import type { CompanyRegistry } from "./company-registry";

function xmlEscape(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Derive the env var prefix a runner will use for this registry. Must
 * stay in sync with `renderCredentialsEnvVars` in company-registry.ts.
 */
function envPrefix(r: CompanyRegistry): string {
  switch (r.type) {
    case "nexus":
    case "artifactory":
    case "jfrog":
    case "harbor":
      return r.type.toUpperCase().replace("-", "_");
    case "github-packages":
      return "GITHUB_PACKAGES";
    case "gitlab-registry":
      return "GITLAB";
    case "gitea-registry":
      return "GITEA";
    case "aws-ecr":
      return "AWS_ECR";
    case "aws-codeartifact":
      return "CODEARTIFACT";
    case "gcp-artifact-registry":
    case "gcp-gcr":
      return "GCP_ARTIFACT_REGISTRY";
    case "azure-container-registry":
      return "AZURE_REGISTRY";
    case "npm-enterprise":
      return "NPM";
    case "pypi-enterprise":
      return "PIP";
    case "docker-registry":
    case "oci-generic":
      return "DOCKER_REGISTRY";
  }
}

/**
 * Produce a Maven <server> block referencing env-var placeholders.
 * Safe to drop into `<servers>...</servers>` inside settings.xml.
 * Special cases: github-packages uses GITHUB_ACTOR/GITHUB_TOKEN;
 * aws-codeartifact uses the CODEARTIFACT_AUTH_TOKEN env var (the
 * runner must call `aws codeartifact get-authorization-token` first).
 */
export function renderMavenSettingsServerBlock(r: CompanyRegistry): string {
  const id = xmlEscape(r.id);
  if (r.type === "github-packages") {
    return [
      `<server>`,
      `  <id>${id}</id>`,
      `  <username>\${env.GITHUB_ACTOR}</username>`,
      `  <password>\${env.GITHUB_TOKEN}</password>`,
      `</server>`,
    ].join("\n");
  }
  if (r.type === "aws-codeartifact") {
    return [
      `<!-- Run: aws codeartifact get-authorization-token ... -->`,
      `<server>`,
      `  <id>${id}</id>`,
      `  <username>aws</username>`,
      `  <password>\${env.CODEARTIFACT_AUTH_TOKEN}</password>`,
      `</server>`,
    ].join("\n");
  }
  const p = envPrefix(r);
  return [
    `<server>`,
    `  <id>${id}</id>`,
    `  <username>\${env.${p}_USER}</username>`,
    `  <password>\${env.${p}_PASSWORD}</password>`,
    `</server>`,
  ].join("\n");
}

/**
 * Produce a Groovy DSL `maven { ... }` block suitable for dropping
 * inside `repositories { }` in a Gradle build script. Credentials
 * always reference env vars — never literals.
 */
export function renderGradleRepositoryBlock(r: CompanyRegistry): string {
  const url = r.url;
  if (r.type === "github-packages") {
    return [
      `maven {`,
      `  name = "${r.id}"`,
      `  url = uri("${url}")`,
      `  credentials {`,
      `    username = System.getenv("GITHUB_ACTOR")`,
      `    password = System.getenv("GITHUB_TOKEN")`,
      `  }`,
      `}`,
    ].join("\n");
  }
  if (r.type === "aws-codeartifact") {
    return [
      `maven {`,
      `  name = "${r.id}"`,
      `  url = uri("${url}")`,
      `  credentials {`,
      `    username = "aws"`,
      `    password = System.getenv("CODEARTIFACT_AUTH_TOKEN")`,
      `  }`,
      `}`,
    ].join("\n");
  }
  const p = envPrefix(r);
  return [
    `maven {`,
    `  name = "${r.id}"`,
    `  url = uri("${url}")`,
    `  credentials {`,
    `    username = System.getenv("${p}_USER")`,
    `    password = System.getenv("${p}_PASSWORD")`,
    `  }`,
    `}`,
  ].join("\n");
}

/**
 * Render the shell command a runner should execute to authenticate
 * docker against this registry. Returns a multiline bash snippet.
 */
export function renderDockerLoginCommand(r: CompanyRegistry): string {
  switch (r.type) {
    case "aws-ecr":
      return [
        `aws ecr get-login-password --region "$AWS_REGION" | \\`,
        `  docker login --username AWS --password-stdin "${r.url}"`,
      ].join("\n");
    case "gcp-artifact-registry":
    case "gcp-gcr":
      return `gcloud auth configure-docker ${r.url} --quiet`;
    case "azure-container-registry":
      return [
        `echo "$AZURE_REGISTRY_PASSWORD" | \\`,
        `  docker login "${r.url}" -u "$AZURE_REGISTRY_USER" --password-stdin`,
      ].join("\n");
    case "github-packages":
      return `echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin`;
    case "gitlab-registry":
      return `echo "$GITLAB_TOKEN" | docker login "${r.url}" -u "$GITLAB_USER" --password-stdin`;
    case "harbor":
    case "nexus":
    case "artifactory":
    case "jfrog":
    case "docker-registry":
    case "oci-generic": {
      const p = envPrefix(r);
      return [
        `echo "$${p}_PASSWORD" | \\`,
        `  docker login "${r.url}" -u "$${p}_USER" --password-stdin`,
      ].join("\n");
    }
    default:
      return `# docker login not supported for ${r.type}`;
  }
}

/**
 * Render a `.npmrc` line binding a scope to this registry. Callers
 * usually pass a scope like "@norlys"; if omitted, the function emits
 * a registry-wide default. Auth token line is included when an auth
 * secret is configured.
 */
export function renderNpmRegistry(r: CompanyRegistry, scope?: string): string {
  const lines: string[] = [];
  const host = r.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (scope) {
    lines.push(`${scope}:registry=${r.url}`);
  } else {
    lines.push(`registry=${r.url}`);
  }
  if (r.authMode === "bearer" || r.authMode === "basic") {
    lines.push(`//${host}/:_authToken=\${NPM_AUTH_TOKEN}`);
  }
  if (r.type === "github-packages") {
    lines.push(`//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}`);
  }
  return lines.join("\n");
}
