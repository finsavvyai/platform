import type { WebSkill } from '../types.js'

export interface RenderedFile {
  path: string
  contents: string
}

export interface RenderOpts {
  hardened: boolean
}

export function renderServerFiles(skill: WebSkill, opts: RenderOpts): RenderedFile[] {
  return [
    { path: 'package.json', contents: renderPackageJson(skill) },
    { path: 'wrangler.toml', contents: renderWrangler(skill) },
    { path: 'src/index.ts', contents: renderIndex(skill, opts.hardened) },
    { path: 'src/skill.ts', contents: renderSkillModule(skill) },
    { path: 'src/runtime.ts', contents: renderRuntimeBootstrap() },
    { path: 'tsconfig.json', contents: renderTsconfig() },
  ]
}

function renderPackageJson(skill: WebSkill): string {
  const pkg = {
    name: `@mcp/${skill.id}-browse`,
    version: skill.version,
    type: 'module',
    private: true,
    main: 'src/index.ts',
    dependencies: {
      '@cloudflare/puppeteer': '^0.0.14',
      '@modelcontextprotocol/sdk': '^0.5.0',
    },
    devDependencies: {
      '@cloudflare/workers-types': '^4.20240725.0',
      wrangler: '^3.78.0',
      typescript: '^5.5.3',
    },
  }
  return JSON.stringify(pkg, null, 2) + '\n'
}

function renderWrangler(skill: WebSkill): string {
  return [
    `name = "${skill.id}-browse-mcp"`,
    'main = "src/index.ts"',
    'compatibility_date = "2026-05-01"',
    '',
    'browser = { binding = "MYBROWSER" }',
    '',
    '[vars]',
    `SKILL_ID = "${skill.id}"`,
    `SKILL_VERSION = "${skill.version}"`,
    '',
  ].join('\n')
}

function renderTsconfig(): string {
  const cfg = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      esModuleInterop: true,
      lib: ['ES2022'],
      types: ['@cloudflare/workers-types'],
    },
  }
  return JSON.stringify(cfg, null, 2) + '\n'
}

function renderSkillModule(skill: WebSkill): string {
  return `export const skill = ${JSON.stringify(skill, null, 2)} as const\n`
}

function renderRuntimeBootstrap(): string {
  return `import { runAction } from '@mcpoverflow/web-skills/runtime'\nimport { skill } from './skill.js'\n\nexport interface Env {\n  MYBROWSER: unknown\n  ALLOWED_EGRESS: string\n}\n\nexport async function callTool(env: Env, name: string, input: Record<string, unknown>) {\n  const allowed = (env.ALLOWED_EGRESS ?? '').split(',').map((s) => s.trim()).filter(Boolean)\n  return runAction({ browser: env.MYBROWSER, skill: skill as never, actionName: name, input, allowedEgress: allowed })\n}\n`
}

function renderIndex(skill: WebSkill, hardened: boolean): string {
  const tools = skill.actions.map(a => ({
    name: a.name,
    description: a.description,
    inputSchema: a.inputSchema,
  }))
  const lines: string[] = []
  lines.push(`import { Server } from '@modelcontextprotocol/sdk/server/index.js'`)
  lines.push(`import { callTool, type Env } from './runtime.js'`)
  if (hardened) {
    lines.push(`import manifest from '../manifest.json' assert { type: 'json' }`)
    lines.push(`import { verifyManifestAgainstTools } from '@mcpoverflow/cli/hardened'`)
  }
  lines.push('')
  lines.push(`const TOOLS = ${JSON.stringify(tools, null, 2)} as const`)
  lines.push('')
  lines.push(`export default {`)
  lines.push(`  async fetch(request: Request, env: Env): Promise<Response> {`)
  if (hardened) {
    lines.push(`    const ok = verifyManifestAgainstTools(manifest as never, TOOLS as never)`)
    lines.push(
      `    if (!ok.valid) return new Response('manifest drift: ' + ok.reason, { status: 500 })`
    )
  }
  lines.push(
    `    const server = new Server({ name: '${skill.id}-browse', version: '${skill.version}' }, { capabilities: { tools: { listChanged: true } } })`
  )
  lines.push(
    `    server.setRequestHandler({ method: 'tools/list' } as never, async () => ({ tools: TOOLS }))`
  )
  lines.push(
    `    server.setRequestHandler({ method: 'tools/call' } as never, async (req: { params: { name: string; arguments: Record<string, unknown> } }) => {`
  )
  lines.push(`      const out = await callTool(env, req.params.name, req.params.arguments)`)
  lines.push(
    `      if (!out.ok) return { isError: true, content: [{ type: 'text', text: JSON.stringify(out.error) }] }`
  )
  lines.push(`      return { content: [{ type: 'text', text: JSON.stringify(out.result) }] }`)
  lines.push(`    })`)
  lines.push(`    return new Response('ok')`)
  lines.push(`  }`)
  lines.push(`}`)
  return lines.join('\n') + '\n'
}
