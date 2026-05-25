import * as vscode from 'vscode'
import type { ActivityLogger, ActivityEvent, ActivitySummary } from '../logger/activity-logger'

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#6b7280',
}

export class ActivityPanel implements vscode.WebviewViewProvider {
  static readonly viewType = 'openagent.activityView'

  private view?: vscode.WebviewView

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: ActivityLogger,
  ) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(ActivityPanel.viewType, this),
    )
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    webviewView.webview.options = { enableScripts: true }
    webviewView.webview.onDidReceiveMessage((msg: { command: string }) => {
      if (msg.command === 'openDashboard') {
        vscode.env.openExternal(vscode.Uri.parse('https://opensyber.cloud?ref=extension-panel'))
      }
      if (msg.command === 'showReport') {
        vscode.commands.executeCommand('openagent.showReport')
      }
    })
    this.render()
  }

  refresh(): void {
    if (this.view) this.render()
  }

  show(): void {
    this.view?.show(true)
  }

  private render(): void {
    if (!this.view) return
    const events = this.logger.getRecent(50)
    const summary = this.logger.getSummary()
    this.view.webview.html = buildHtml(events, summary)
  }
}

function buildHtml(events: ActivityEvent[], summary: ActivitySummary): string {
  const rows = events
    .map(
      (e) => `
      <div class="event">
        <span class="badge" style="color:${RISK_COLORS[e.risk] ?? '#6b7280'}">
          ${e.risk.toUpperCase()}
        </span>
        <div class="event-body">
          <div class="summary">${escapeHtml(e.summary)}</div>
          <div class="meta">${e.agent} · ${new Date(e.timestamp).toLocaleTimeString()}</div>
        </div>
      </div>`,
    )
    .join('')

  const emptyState = `
    <div class="empty">
      <div>No activity yet</div>
      <div class="empty-sub">OpenAgent is monitoring. File reads and terminal commands appear here.</div>
    </div>`

  const ctaBlock =
    summary.critical > 0
      ? `<button class="cta" onclick="vsPostMessage('openDashboard')">
           Get team visibility → opensyber.cloud
         </button>`
      : ''

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <style>
    *   { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0a; color: #e5e5e5; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; }
    .header { padding: 10px 12px; background: #111; border-bottom: 1px solid #1c1c1c; }
    .logo { color: #3b82f6; font-weight: 700; font-size: 13px; margin-bottom: 6px;
            display: flex; align-items: center; justify-content: space-between; }
    .report-link { font-size: 10px; font-weight: 500; color: #3b82f6; cursor: pointer;
                   background: none; border: none; padding: 0; text-decoration: underline; }
    .report-link:hover { color: #60a5fa; }
    .stats { display: flex; gap: 12px; flex-wrap: wrap; }
    .stat { font-size: 11px; color: #a3a3a3; }
    .stat-val { font-weight: 600; }
    .event { display: flex; gap: 8px; padding: 7px 10px; border-bottom: 1px solid #171717; align-items: flex-start; }
    .badge { font-size: 9px; font-weight: 700; min-width: 50px; padding-top: 1px; letter-spacing: 0.04em; }
    .event-body { overflow: hidden; }
    .summary { font-size: 11px; color: #d4d4d4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta { font-size: 10px; color: #525252; margin-top: 2px; }
    .empty { padding: 28px 16px; text-align: center; color: #404040; }
    .empty-sub { font-size: 10px; margin-top: 6px; color: #2e2e2e; }
    .cta { display: block; width: calc(100% - 16px); margin: 10px 8px; padding: 8px;
           background: #1d4ed8; border: none; border-radius: 6px; color: #fff;
           font-size: 11px; cursor: pointer; text-align: center; }
    .cta:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <span>⬡ OpenAgent</span>
      <button class="report-link" onclick="vsPostMessage('showReport')">View Report →</button>
    </div>
    <div class="stats">
      <span class="stat">🔴 <span class="stat-val">${summary.critical}</span> critical</span>
      <span class="stat">🟠 <span class="stat-val">${summary.high}</span> high</span>
      <span class="stat">🔑 <span class="stat-val">${summary.secretsDetected}</span> secrets</span>
    </div>
  </div>
  ${events.length > 0 ? rows : emptyState}
  ${ctaBlock}
  <script>
    function vsPostMessage(command) {
      const vscode = acquireVsCodeApi();
      vscode.postMessage({ command });
    }
  </script>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
