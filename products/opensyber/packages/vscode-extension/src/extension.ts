import * as vscode from 'vscode'
import { AgentDetector } from './detectors/agent-detector'
import { FileInterceptor } from './interceptors/file-interceptor'
import { WriteInterceptor } from './interceptors/write-interceptor'
import { TerminalInterceptor } from './interceptors/terminal-interceptor'
import { ActivityLogger } from './logger/activity-logger'
import { RiskNotifier } from './notifications/risk-notifier'
import { ActivityPanel } from './views/activity-panel'
import { writeReportToDisk } from './reports/html-generator'
import { CloudSync } from './sync/cloud-sync'

const SYNC_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes

function buildSync(): CloudSync {
  const cfg    = vscode.workspace.getConfiguration('openagent')
  const apiKey = cfg.get<string>('apiKey', '')
  const apiUrl = 'https://api.opensyber.cloud'
  return new CloudSync(apiUrl, apiKey)
}

export function activate(context: vscode.ExtensionContext): void {
  const logger   = new ActivityLogger()
  const detector = new AgentDetector()
  const notifier = new RiskNotifier()
  const panel    = new ActivityPanel(context, logger)

  const fileInterceptor     = new FileInterceptor(logger, detector, notifier, panel)
  const writeInterceptor    = new WriteInterceptor(logger, detector, notifier, panel)
  const terminalInterceptor = new TerminalInterceptor(logger, detector, notifier, panel)

  fileInterceptor.activate(context)
  writeInterceptor.activate(context)
  terminalInterceptor.activate(context)

  // Background sync every 5 minutes (no-op when apiKey not set)
  const syncTimer = setInterval(async () => {
    const sync = buildSync()
    if (!sync.isEnabled()) return
    const result = await sync.sync(logger.getRecent(500))
    if (result.error) console.warn('[OpenAgent] sync error:', result.error)
  }, SYNC_INTERVAL_MS)

  context.subscriptions.push({
    dispose: () => clearInterval(syncTimer),
  })

  context.subscriptions.push(
    vscode.commands.registerCommand('openagent.showReport', async () => {
      const events   = logger.getRecent(500)
      const summary  = logger.getSummary()
      const agents   = detector.getActiveAgents().filter((a) => a !== 'Unknown')

      // Sync to cloud before generating report (if enabled)
      const sync   = buildSync()
      const result = await sync.sync(events)
      if (result.synced > 0) {
        vscode.window.setStatusBarMessage(`$(cloud-upload) OpenAgent: synced ${result.synced} events`, 3000)
      }

      const reportPath = writeReportToDisk({ events, summary, agents, generatedAt: new Date().toLocaleString() })
      vscode.env.openExternal(vscode.Uri.file(reportPath))
    }),

    vscode.commands.registerCommand('openagent.clearActivity', () => {
      logger.clear()
      panel.refresh()
      vscode.window.showInformationMessage('OpenAgent: Activity log cleared.')
    }),
  )

  const agents = detector.getActiveAgents()
  const agentLabel = agents[0] !== 'Unknown' ? agents.join(', ') : 'AI agents'
  vscode.window.setStatusBarMessage(`$(shield) OpenAgent: monitoring ${agentLabel}`, 4000)
}

export function deactivate(): void {
  // Subscriptions are cleaned up automatically via context.subscriptions
}
