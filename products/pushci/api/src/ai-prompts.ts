// AI prompt templates for PushCI pipeline generation and diagnosis.

interface PromptPair {
  system: string;
  user: string;
}

interface RepoContext {
  languages: string[];
  packageManagers: string[];
  frameworks: string[];
  buildFiles: string[];
  repoName: string;
}

export function generatePipelinePrompt(ctx: RepoContext): PromptPair {
  return {
    system: `You are a senior DevOps architect specializing in CI/CD.
Generate a PushCI pipeline YAML file. Use only valid PushCI syntax.
Output ONLY the YAML inside a single \`\`\`yaml code block.
Include: install, lint, test, build steps. Add caching when possible.
Target sub-2-minute pipelines. Never include secrets in plaintext.`,
    user: `Generate a PushCI pipeline for repository "${ctx.repoName}".
Languages: ${ctx.languages.join(", ")}
Package managers: ${ctx.packageManagers.join(", ")}
Frameworks: ${ctx.frameworks.join(", ")}
Build files found: ${ctx.buildFiles.join(", ")}`,
  };
}

interface FailureContext {
  logs: string;
  checkName: string;
  exitCode?: number;
}

export function explainFailurePrompt(ctx: FailureContext): PromptPair {
  return {
    system: `You are a CI/CD debugging expert. Analyze the failing CI log.
Provide: 1) Root cause (1-2 sentences), 2) Fix (specific command or
config change), 3) Prevention tip. Be concise and actionable.`,
    user: `CI check "${ctx.checkName}" failed${ctx.exitCode ? ` (exit ${ctx.exitCode})` : ""}.

Logs:
${ctx.logs.slice(0, 4000)}`,
  };
}

export function convertActionsPrompt(actionsYaml: string): PromptPair {
  return {
    system: `You convert GitHub Actions YAML to PushCI pipeline YAML.
PushCI format:
  name: pipeline-name
  steps:
    - name: step-name
      run: command
      cache: path (optional)
Map actions/checkout to implicit clone. Map actions/setup-* to
runtime auto-detect. Output ONLY valid PushCI YAML in a code block.`,
    user: `Convert this GitHub Actions workflow to PushCI format:

\`\`\`yaml
${actionsYaml}
\`\`\``,
  };
}

export function optimizeCachePrompt(pipelineYaml: string): PromptPair {
  return {
    system: `You are a CI performance expert. Analyze the pipeline YAML
and suggest caching improvements. For each suggestion provide the
exact YAML change. Focus on: dependency caches, build artifact
caches, and layer caching for Docker builds.`,
    user: `Suggest caching improvements for this PushCI pipeline:

\`\`\`yaml
${pipelineYaml}
\`\`\``,
  };
}
