export default function SkillsDocsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide tracking-tight">Skills Development</h1>
      <p className="text-lg text-text-secondary mt-2">
        Build, submit, and publish skills to the OpenSyber marketplace.
      </p>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">What is a Skill?</h2>
      <p className="text-text-secondary">
        A skill is a packaged capability that extends your AI agent. Skills can integrate with
        external APIs, perform file operations, manage databases, or add specialized functionality.
        Each skill runs in a sandboxed environment with defined permissions.
      </p>

      <h2 className="text-2xl font-semibold mt-8">Skill Structure</h2>
      <div className="rounded bg-surface/50 p-4 mt-4">
        <code className="text-sm text-text-primary whitespace-pre">{`my-skill/
  manifest.json    # Name, version, permissions, entry point
  index.ts         # Main entry point
  README.md        # Documentation
  tests/           # Test suite (required for verification)`}</code>
      </div>

      <h2 className="text-2xl font-semibold mt-8">Manifest File</h2>
      <div className="rounded bg-surface/50 p-4 mt-4">
        <code className="text-sm text-text-primary whitespace-pre">{`{
  "name": "github-integration",
  "version": "1.0.0",
  "description": "Manage GitHub repos and PRs",
  "permissions": ["network:api.github.com", "credential:GITHUB_TOKEN"],
  "entry": "index.ts"
}`}</code>
      </div>

      <h2 className="text-2xl font-semibold mt-8">Verification Pipeline</h2>
      <p className="text-text-secondary">
        Every skill submitted to the marketplace goes through a multi-stage verification process:
      </p>
      <ol className="space-y-2 text-text-secondary">
        <li><strong className="text-white">Automated scanning</strong> — Dependency vulnerability checks, static analysis</li>
        <li><strong className="text-white">Sandboxed execution</strong> — The skill runs in an isolated environment with test cases</li>
        <li><strong className="text-white">Code review</strong> — Manual review by the OpenSyber security team</li>
        <li><strong className="text-white">Verification badge</strong> — Approved skills receive the &quot;OpenSyber Verified&quot; badge</li>
      </ol>

      <h2 className="text-2xl font-semibold mt-8">Submitting a Skill</h2>
      <ol className="space-y-2 text-text-secondary">
        <li>Package your skill with a valid manifest and test suite</li>
        <li>Go to Dashboard &rarr; Skills &rarr; Submit Skill</li>
        <li>Upload your skill package (.zip)</li>
        <li>Verification typically completes within 24-48 hours</li>
        <li>Once approved, your skill appears in the marketplace</li>
      </ol>

      <h2 className="text-2xl font-semibold mt-8">Permissions Model</h2>
      <p className="text-text-secondary">
        Skills declare their required permissions in the manifest. Users see these permissions
        before installing. Permissions include network access (by domain), credential access
        (by name), and file access (by path pattern).
      </p>

      <hr className="border-border my-8" />

      <h2 className="text-2xl font-semibold">Using AI coding tools with OpenSyber</h2>
      <p className="text-text-secondary">
        OpenSyber publishes an Agent Skills package (Anthropic-originated open standard) so
        AI coding tools like Claude Code, Cursor, Copilot, Codex CLI, and Gemini CLI generate
        correct OpenSyber code by default.
      </p>
      <div className="rounded bg-surface/50 p-4 mt-4">
        <code className="text-sm text-text-primary">npx skills add opensyber/agent-skills</code>
      </div>
      <p className="text-text-secondary text-sm mt-3">
        Installs 8 instruction packs covering quickstart, the REST API, runtime skill authoring,
        TokenForge sessions, the marketplace, CSPM, the Claw SDK, and PipeWarden integration.
        Repository: <code className="text-signal">packages/agent-skills/</code> in this monorepo.
      </p>

      <p className="text-text-secondary text-sm mt-4 italic">
        Note: &quot;runtime skills&quot; (what this page documents) and &quot;Agent Skills&quot;
        (the AI-tool instruction packs above) are different concepts that share a name.
        Runtime skills are Node.js modules executing on an agent VM. Agent Skills are markdown
        instructions that teach AI coding tools how to use this platform.
      </p>
    </article>
  );
}
