/**
 * Verifier — shared format with OpenSyber's drift watcher.
 * Compares the live tool list (from tools.json) against the signed manifest.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  verifyManifestAgainstTools,
  verifyManifestSignature,
  type SignedManifest,
  type ToolDefinition,
} from './hardened/index.js'

export interface VerifyReport {
  ok: boolean
  checks: { name: string; ok: boolean; detail?: string }[]
}

export async function verifyHardenedServer(serverDir: string): Promise<VerifyReport> {
  const checks: VerifyReport['checks'] = []

  const manifestRaw = await readFile(path.join(serverDir, 'mcp-manifest.json'), 'utf-8').catch(
    () => null
  )
  if (!manifestRaw) {
    return {
      ok: false,
      checks: [{ name: 'mcp-manifest.json present', ok: false, detail: 'not found' }],
    }
  }
  checks.push({ name: 'mcp-manifest.json present', ok: true })

  const manifest = JSON.parse(manifestRaw) as SignedManifest

  const sig = verifyManifestSignature(manifest)
  checks.push({ name: 'ed25519 signature', ok: sig.ok, detail: sig.reason })
  if (!sig.ok) return { ok: false, checks }

  const toolsRaw = await readFile(path.join(serverDir, 'tools.json'), 'utf-8').catch(() => null)
  if (!toolsRaw) {
    checks.push({ name: 'tools.json present', ok: false, detail: 'not found' })
    return { ok: false, checks }
  }
  checks.push({ name: 'tools.json present', ok: true })

  const liveTools = JSON.parse(toolsRaw) as ToolDefinition[]
  const drift = verifyManifestAgainstTools(manifest, liveTools)
  checks.push({ name: 'tool hashes match manifest', ok: drift.ok, detail: drift.reason })

  return { ok: checks.every(c => c.ok), checks }
}
