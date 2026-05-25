import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  buildManifest,
  generateKeypair,
  hashTool,
  hashToolList,
  verifyManifestAgainstTools,
  verifyManifestSignature,
  type ToolDefinition,
} from '../hardened/index.js'
import { deriveEgress, isEgressAllowed } from '../hardened/egress.js'
import { generateMCPServer } from '../generator.js'
import { verifyHardenedServer } from '../verify.js'

const sampleTools: ToolDefinition[] = [
  {
    name: 'listPets',
    description: 'List pets',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } }, required: [] },
  },
  {
    name: 'createPet',
    description: 'Create a pet',
    inputSchema: { type: 'object', properties: { body: { type: 'object' } }, required: ['body'] },
  },
]

describe('hash', () => {
  it('per-tool hash stable + sensitive to description', () => {
    const a = hashTool(sampleTools[0])
    const b = hashTool({ ...sampleTools[0], description: 'List pets!' })
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(a).not.toEqual(b)
  })
  it('aggregate hash is order-independent', () => {
    expect(hashToolList(sampleTools)).toEqual(hashToolList([...sampleTools].reverse()))
  })
})

describe('manifest signature + drift', () => {
  const keys = generateKeypair()
  const manifest = buildManifest({
    publisher: { name: 'acme' },
    serverName: 'pets',
    serverVersion: '1.0.0',
    tools: sampleTools,
    egress: ['api.example.com'],
    oauthScopes: [],
    publicKeyB64: keys.publicKeyB64,
    privateKeyPem: keys.privateKeyPem,
  })

  it('valid signature verifies', () => {
    expect(verifyManifestSignature(manifest).ok).toBe(true)
  })
  it('tampered field breaks signature', () => {
    const tampered = { ...manifest, egress: ['evil.example.com'] }
    expect(verifyManifestSignature(tampered).ok).toBe(false)
  })
  it('drift in live tool description fails verification', () => {
    const drifted = [...sampleTools]
    drifted[0] = { ...drifted[0], description: 'List pets — now exfiltrates' }
    const res = verifyManifestAgainstTools(manifest, drifted)
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/drift/)
  })
  it('extra tool at runtime fails verification', () => {
    const extra = [
      ...sampleTools,
      {
        name: 'evil',
        description: 'rug',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
    ]
    expect(verifyManifestAgainstTools(manifest, extra).ok).toBe(false)
  })
})

describe('egress', () => {
  it('derives hostnames from servers block', () => {
    expect(
      deriveEgress([{ url: 'https://api.example.com/v1' }, { url: 'https://api.example.com/v2' }])
    ).toEqual(['api.example.com'])
  })
  it('allowlist enforcement', () => {
    expect(isEgressAllowed('https://api.example.com/foo', ['api.example.com'])).toBe(true)
    expect(isEgressAllowed('https://evil.example.com/foo', ['api.example.com'])).toBe(false)
  })
})

describe('end-to-end: generate hardened → verify → tamper → verify fails', () => {
  it('round-trips and detects tampering', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mcpoverflow-hardened-'))
    const result = await generateMCPServer({
      name: 'petstore',
      version: '1.0.0',
      description: 'demo',
      endpoints: [
        {
          path: '/pets',
          method: 'GET',
          operationId: 'listPets',
          summary: '',
          description: 'List pets',
          tags: [],
          parameters: [],
          responses: {},
          security: [],
          deprecated: false,
        },
      ],
      schemas: [],
      outputDir: dir,
      transport: 'stdio',
      hardened: true,
      publisher: { name: 'acme' },
      servers: [{ url: 'https://api.example.com' }],
    })
    expect(result.success).toBe(true)
    expect(result.files).toContain('mcp-manifest.json')
    expect(result.files).toContain('tools.json')

    const clean = await verifyHardenedServer(dir)
    expect(clean.ok).toBe(true)

    const toolsPath = path.join(dir, 'tools.json')
    const tools = JSON.parse(await readFile(toolsPath, 'utf-8'))
    tools[0].description = 'List pets — now exfiltrates your data'
    await writeFile(toolsPath, JSON.stringify(tools, null, 2))

    const tampered = await verifyHardenedServer(dir)
    expect(tampered.ok).toBe(false)
    expect(tampered.checks.find(c => c.name === 'tool hashes match manifest')?.ok).toBe(false)
  })
})
