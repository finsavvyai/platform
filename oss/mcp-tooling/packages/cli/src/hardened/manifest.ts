/**
 * Signed manifest — the supply-side artifact that pins what an MCP server
 * is allowed to expose. Verifier (and OpenSyber's runtime watcher) compare
 * the live tool list against this signed pin to detect rug-pulls.
 */

import { canonicalize } from './canonical.js'
import { hashToolList, perToolHashes, type ToolDefinition, type ToolHash } from './hash.js'
import { signBytes, verifyBytes } from './keys.js'

export interface ManifestPublisher {
  name: string
  url?: string
}

export interface ManifestBody {
  spec: 'mcpoverflow.hardened/1'
  publisher: ManifestPublisher
  server: { name: string; version: string }
  tools: ToolHash[]
  aggregateHash: string
  egress: string[]
  oauthScopes: string[]
  generatedAt: string
  publicKey: string
  algorithm: 'ed25519'
}

export interface SignedManifest extends ManifestBody {
  signature: string // base64 over canonicalize(ManifestBody)
}

export interface BuildManifestArgs {
  publisher: ManifestPublisher
  serverName: string
  serverVersion: string
  tools: ToolDefinition[]
  egress: string[]
  oauthScopes: string[]
  publicKeyB64: string
  privateKeyPem: string
}

export function buildManifest(args: BuildManifestArgs): SignedManifest {
  const body: ManifestBody = {
    spec: 'mcpoverflow.hardened/1',
    publisher: args.publisher,
    server: { name: args.serverName, version: args.serverVersion },
    tools: perToolHashes(args.tools),
    aggregateHash: hashToolList(args.tools),
    egress: [...args.egress].sort(),
    oauthScopes: [...args.oauthScopes].sort(),
    generatedAt: new Date().toISOString(),
    publicKey: args.publicKeyB64,
    algorithm: 'ed25519',
  }
  const signature = signBytes(canonicalize(body), args.privateKeyPem)
  return { ...body, signature }
}

export interface VerifyResult {
  ok: boolean
  reason?: string
}

export function verifyManifestSignature(manifest: SignedManifest): VerifyResult {
  const { signature, ...body } = manifest
  const ok = verifyBytes(canonicalize(body), signature, manifest.publicKey)
  return ok ? { ok: true } : { ok: false, reason: 'signature mismatch' }
}

export function verifyManifestAgainstTools(
  manifest: SignedManifest,
  liveTools: ToolDefinition[]
): VerifyResult {
  const sig = verifyManifestSignature(manifest)
  if (!sig.ok) return sig

  const liveAggregate = hashToolList(liveTools)
  if (liveAggregate !== manifest.aggregateHash) {
    return {
      ok: false,
      reason: `aggregate hash drift: ${manifest.aggregateHash} → ${liveAggregate}`,
    }
  }

  const livePerTool = perToolHashes(liveTools)
  const byName = new Map(livePerTool.map(t => [t.name, t.hash]))
  for (const pinned of manifest.tools) {
    const live = byName.get(pinned.name)
    if (!live) return { ok: false, reason: `tool missing at runtime: ${pinned.name}` }
    if (live !== pinned.hash) return { ok: false, reason: `tool drift: ${pinned.name}` }
    byName.delete(pinned.name)
  }
  if (byName.size > 0) {
    return { ok: false, reason: `extra tools at runtime: ${[...byName.keys()].join(', ')}` }
  }
  return { ok: true }
}
