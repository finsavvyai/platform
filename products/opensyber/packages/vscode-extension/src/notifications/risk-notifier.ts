import * as vscode from 'vscode'
import type { ActivityEvent } from '../logger/activity-logger'

const UPGRADE_URL = 'https://opensyber.cloud?ref=extension-critical'
const COOLDOWN_MS = 30_000  // 30 seconds per unique event key

export class RiskNotifier {
  private readonly lastNotified = new Map<string, number>()

  notifyCritical(event: ActivityEvent): void {
    const config = vscode.workspace.getConfiguration('openagent')
    if (!config.get<boolean>('notifications.critical', true)) return

    // Deduplicate: don't notify for the same file/command within cooldown window
    const key = event.path ?? event.summary.slice(0, 50)
    const lastTime = this.lastNotified.get(key) ?? 0
    if (Date.now() - lastTime < COOLDOWN_MS) return
    this.lastNotified.set(key, Date.now())

    const message = `⚠ OpenAgent: ${event.summary.slice(0, 70)}`

    vscode.window
      .showWarningMessage(message, 'View Activity', 'Get Team Visibility')
      .then((action) => {
        if (action === 'View Activity') {
          vscode.commands.executeCommand('openagent.showReport')
        }
        if (action === 'Get Team Visibility') {
          vscode.env.openExternal(vscode.Uri.parse(UPGRADE_URL))
        }
      })
  }
}
