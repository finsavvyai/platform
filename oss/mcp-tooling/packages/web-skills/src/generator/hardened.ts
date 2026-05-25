import { hardened } from '@mcpoverflow/cli'
import type { WebSkill } from '../types.js'
import { deriveSkillEgress } from './derive-egress.js'

export type ManifestPublisher = hardened.ManifestPublisher
export type SignedManifest = hardened.SignedManifest
export type ToolDefinition = hardened.ToolDefinition

export interface SignSkillArgs {
  skill: WebSkill
  publisher: ManifestPublisher
  privateKeyPem?: string
  publicKeyB64?: string
}

export interface SignSkillResult {
  manifest: SignedManifest
  publicKey: string
  privateKey: string
}

export function skillToToolDefinitions(skill: WebSkill): ToolDefinition[] {
  return skill.actions
    .map(a => ({
      name: a.name,
      description: a.description,
      inputSchema: a.inputSchema as Record<string, unknown>,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function signSkill(args: SignSkillArgs): SignSkillResult {
  const keys =
    args.privateKeyPem && args.publicKeyB64
      ? { privateKeyPem: args.privateKeyPem, publicKeyB64: args.publicKeyB64 }
      : derivedKeys()

  const tools = skillToToolDefinitions(args.skill)
  const egress = deriveSkillEgress(args.skill)

  const manifest = hardened.buildManifest({
    publisher: args.publisher,
    serverName: `${args.skill.id}-browse`,
    serverVersion: args.skill.version,
    tools,
    egress,
    oauthScopes: [],
    publicKeyB64: keys.publicKeyB64,
    privateKeyPem: keys.privateKeyPem,
  })

  return { manifest, publicKey: keys.publicKeyB64, privateKey: keys.privateKeyPem }
}

function derivedKeys(): { privateKeyPem: string; publicKeyB64: string } {
  const kp = hardened.generateKeypair()
  return { privateKeyPem: kp.privateKeyPem, publicKeyB64: kp.publicKeyB64 }
}
