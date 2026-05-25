import * as vscode from 'vscode'
import * as path from 'path'
import type { ActivityLogger } from '../logger/activity-logger'
import type { AgentDetector } from '../detectors/agent-detector'
import type { RiskNotifier } from '../notifications/risk-notifier'
import type { ActivityPanel } from '../views/activity-panel'
import { SecretDetector } from '../detectors/secret-detector'
import { assessWriteRisk } from './risk-classifier'

export { assessWriteRisk } from './risk-classifier'

export class WriteInterceptor {
  private readonly secretDetector = new SecretDetector()

  constructor(
    private readonly logger: ActivityLogger,
    private readonly agentDetector: AgentDetector,
    private readonly notifier: RiskNotifier,
    private readonly panel: ActivityPanel,
  ) {}

  activate(context: vscode.ExtensionContext): void {
    const sub = vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.scheme !== 'file') return
      this.handleWrite(doc.uri.fsPath, doc.getText())
    })
    context.subscriptions.push(sub)
  }

  private handleWrite(filePath: string, content: string): void {
    const risk = assessWriteRisk(filePath)
    if (risk === 'low') return

    const agent = this.agentDetector.detectActive()
    const { count: secretsCount } = this.secretDetector.scan(content)
    const fileName = path.basename(filePath)
    const secretNote = secretsCount > 0 ? ` · ${secretsCount} secret pattern(s) detected` : ''
    const summary = `Wrote ${fileName}${secretNote}`

    const event = this.logger.log({ agent, type: 'file_write', risk, path: filePath, summary, secretsCount })
    this.panel.refresh()

    if (risk === 'critical') {
      this.notifier.notifyCritical(event)
    }
  }
}
