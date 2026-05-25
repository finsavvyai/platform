import * as vscode from 'vscode'
import type { ActivityLogger, RiskLevel } from '../logger/activity-logger'
import type { AgentDetector } from '../detectors/agent-detector'
import type { RiskNotifier } from '../notifications/risk-notifier'
import type { ActivityPanel } from '../views/activity-panel'

export function assessCommandRisk(command: string): RiskLevel {
  const cmd = command.toLowerCase().trim()

  // Critical: potential secret exfiltration or remote code execution
  if (/curl\s+.+\|\s*(ba)?sh/.test(cmd)) return 'critical'
  if (/wget\s+.+\|\s*(ba)?sh/.test(cmd)) return 'critical'
  if (/cat\s+.*\.env/.test(cmd)) return 'critical'
  if (/cat\s+.*credentials/.test(cmd)) return 'critical'
  if (/\bprintenv\b/.test(cmd)) return 'critical'
  if (/export\s+\w*(key|secret|token|password)\w*=/i.test(cmd)) return 'critical'
  if (/echo\s+\$\w*(key|secret|token)\w*/i.test(cmd)) return 'critical'

  // High: privilege escalation and sensitive operations
  if (/^sudo\s/.test(cmd)) return 'high'
  if (/chmod\s+[0-9]*7[0-9]*/.test(cmd)) return 'high'
  if (/\bssh\s+/.test(cmd)) return 'high'
  if (/aws\s+iam/.test(cmd)) return 'high'
  if (/gcloud\s+iam/.test(cmd)) return 'high'
  if (/az\s+role\s+assignment/.test(cmd)) return 'high'
  if (/kubectl\s+(exec|port-forward|proxy)/.test(cmd)) return 'high'
  if (/\bgpg\s+/.test(cmd)) return 'high'

  // Medium: network and package operations
  if (/^(npm|yarn|pnpm)\s+install/.test(cmd)) return 'medium'
  if (/^pip\s+install/.test(cmd)) return 'medium'
  if (/^gem\s+install/.test(cmd)) return 'medium'
  if (/^go\s+get/.test(cmd)) return 'medium'
  if (/\bcurl\s+/.test(cmd)) return 'medium'
  if (/\bwget\s+/.test(cmd)) return 'medium'
  if (/docker\s+(run|pull|push|exec)/.test(cmd)) return 'medium'

  return 'low'
}

export class TerminalInterceptor {
  constructor(
    private readonly logger: ActivityLogger,
    private readonly agentDetector: AgentDetector,
    private readonly notifier: RiskNotifier,
    private readonly panel: ActivityPanel,
  ) {}

  activate(context: vscode.ExtensionContext): void {
    // onDidStartTerminalShellExecution — fires when shell integration detects a command start
    // Requires VS Code 1.93+ and shell integration enabled (on by default)
    const sub = vscode.window.onDidStartTerminalShellExecution((e) => {
      const command = e.execution.commandLine.value
      if (!command || command.trim().length < 2) return
      this.handleCommand(command.trim())
    })
    context.subscriptions.push(sub)
  }

  private handleCommand(command: string): void {
    const risk = assessCommandRisk(command)
    if (risk === 'low') return

    const agent = this.agentDetector.detectActive()
    const summary = `Executed: ${command.slice(0, 80)}${command.length > 80 ? '…' : ''}`
    const event = this.logger.log({ agent, type: 'bash_exec', risk, summary, secretsCount: 0 })
    this.panel.refresh()

    if (risk === 'critical') this.notifier.notifyCritical(event)
  }
}
