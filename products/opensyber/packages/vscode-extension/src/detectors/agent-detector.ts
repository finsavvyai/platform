import * as vscode from 'vscode'

export type AgentName =
  | 'Cursor'
  | 'Cline'
  | 'Claude Code'
  | 'Devin'
  | 'Copilot'
  | 'Continue'
  | 'Unknown'

// Extension IDs for known AI coding agents
const AGENT_EXTENSIONS: Array<{ id: string; name: AgentName }> = [
  { id: 'saoudrizwan.claude-dev', name: 'Cline' },
  { id: 'anthropic.claude-code', name: 'Claude Code' },
  { id: 'github.copilot', name: 'Copilot' },
  { id: 'continue.continue', name: 'Continue' },
]

export class AgentDetector {
  detectActive(): AgentName {
    // Cursor identifies itself via appName
    if (vscode.env.appName.toLowerCase().includes('cursor')) {
      return 'Cursor'
    }

    // Check which AI agent extensions are currently active
    for (const { id, name } of AGENT_EXTENSIONS) {
      const ext = vscode.extensions.getExtension(id)
      if (ext?.isActive) return name
    }

    return 'Unknown'
  }

  getActiveAgents(): AgentName[] {
    const agents: AgentName[] = []

    if (vscode.env.appName.toLowerCase().includes('cursor')) {
      agents.push('Cursor')
    }

    for (const { id, name } of AGENT_EXTENSIONS) {
      const ext = vscode.extensions.getExtension(id)
      if (ext?.isActive) agents.push(name)
    }

    return agents.length > 0 ? agents : ['Unknown']
  }
}
