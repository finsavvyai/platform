import type { WebSkill } from '../types.js'
import { validateSkill } from '../registry.js'
import { deriveSkillEgress } from './derive-egress.js'
import { renderServerFiles, type RenderedFile } from './render-server.js'

export interface GenerateOpts {
  hardened?: boolean
  publisher?: { name: string; publicKey: string }
}

export interface GeneratorOutput {
  files: RenderedFile[]
  egress: string[]
  toolNames: string[]
}

export function generateFromSkill(skill: WebSkill, opts: GenerateOpts = {}): GeneratorOutput {
  validateSkill(skill)
  const hardened = !!opts.hardened
  const files = renderServerFiles(skill, { hardened })
  const egress = deriveSkillEgress(skill)
  files.push({
    path: '.env.example',
    contents: `ALLOWED_EGRESS=${egress.join(',')}\n`,
  })
  return {
    files,
    egress,
    toolNames: skill.actions.map(a => a.name),
  }
}

export { renderServerFiles, deriveSkillEgress }
export type { RenderedFile }
